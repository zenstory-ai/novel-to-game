#!/usr/bin/env python3
"""把一段真实录屏转成 X(Twitter) 能正常吃下的 MP4,并把规格逐条验回来。

这一层刻意不认识任何一个示例:输入是一段视频,输出是一段视频加一份 ffprobe 实测报告。
录制(谁在按键、按了什么)属于各示例的 qa/,编码与验收是通用的,所以放在 scripts/。

X 的硬性规格(超了不会报错,只会静默转码失败或播不出来):
  容器 mp4 / 视频 H.264 High Profile / 像素格式 yuv420p(只支持 4:2:0)
  逐行扫描 / 闭合 GOP / 像素宽高比 1:1 / <=60fps
  时长 0.5-140s / 文件 <=512MB / 边长 32x32 - 1280x1024 / 画幅比 1:3 - 3:1
音轨默认整条不写:参考样本里跑赢的片子要么没有音轨,要么是数字静音。

跑法:
  python3 scripts/xclip.py encode <in.webm> --out <out.mp4> [--start S] [--duration S]
  python3 scripts/xclip.py verify <out.mp4>
  python3 scripts/xclip.py contact-sheet <in.webm> --out <dir> [--every 1.0]
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

# X 规格上限。数字来自 docs.x.com 的媒体上传约束,不是估的。
MAX_BYTES = 512 * 1024 * 1024
MIN_SECONDS, MAX_SECONDS = 0.5, 140.0
MIN_EDGE, MAX_W, MAX_H = 32, 1280, 1024
MAX_FPS = 60
MIN_ASPECT, MAX_ASPECT = Fraction(1, 3), Fraction(3, 1)


def need(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        sys.exit(f"缺少 {tool},装了再跑")
    return path


def probe(path: Path) -> dict:
    out = subprocess.run(
        [need("ffprobe"), "-v", "error", "-print_format", "json",
         "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def encode(src: Path, out: Path, start: float | None, duration: float | None,
           fps: int, crf: int, keep_audio: bool) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [need("ffmpeg"), "-y"]
    # -ss 放在 -i 前是关键帧粗定位,快但会漂;放在 -i 后逐帧解码到位,慢但精确。
    # 二十秒的片子里差半秒就是差一个结算,所以用精确的那种。
    cmd += ["-i", str(src)]
    if start is not None:
        cmd += ["-ss", f"{start:.3f}"]
    if duration is not None:
        cmd += ["-t", f"{duration:.3f}"]
    # setpts 重置时间戳:从中间截出来的段落如果不重置,首帧 pts 不是 0,
    # 有些播放器会先黑一下再开始。
    cmd += ["-vf", f"fps={fps},setsar=1:1,setpts=PTS-STARTPTS"]
    cmd += ["-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
            "-pix_fmt", "yuv420p", "-crf", str(crf), "-preset", "slow",
            # 闭合 GOP:X 明确不支持 open GOP。
            "-g", str(fps * 2), "-keyint_min", str(fps * 2),
            "-x264-params", "open-gop=0",
            "-movflags", "+faststart"]
    cmd += ["-an"] if not keep_audio else ["-c:a", "aac", "-profile:a", "aac_low", "-b:a", "128k"]
    cmd += [str(out)]
    subprocess.run(cmd, check=True, capture_output=True)


def first_frame_luma(path: Path) -> float:
    """首帧平均亮度。X 拿第 0 帧当缩略图,黑屏首帧等于把最贵的一次曝光扔了。"""
    # metadata=print 走 info 级日志,这里不能用 -v error,否则读不到任何一行。
    res = subprocess.run(
        [need("ffmpeg"), "-v", "info", "-i", str(path), "-vf",
         "select=eq(n\\,0),signalstats,metadata=print", "-frames:v", "1",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    for line in res.stderr.splitlines():
        if "signalstats.YAVG" in line:
            return float(line.rsplit("=", 1)[1])
    return -1.0


def verify(path: Path) -> int:
    info = probe(path)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if v is None:
        print("FAIL  没有视频流")
        return 1

    size = path.stat().st_size
    dur = float(info["format"]["duration"])
    w, h = int(v["width"]), int(v["height"])
    num, den = (int(x) for x in v["avg_frame_rate"].split("/"))
    fps = num / den if den else 0.0
    aspect = Fraction(w, h)
    luma = first_frame_luma(path)

    checks = [
        ("容器", info["format"]["format_name"], "mp4" in info["format"]["format_name"]),
        ("视频编码", v["codec_name"], v["codec_name"] == "h264"),
        ("profile", v.get("profile"), v.get("profile") == "High"),
        ("像素格式", v.get("pix_fmt"), v.get("pix_fmt") == "yuv420p"),
        ("像素宽高比", v.get("sample_aspect_ratio", "1:1"),
         v.get("sample_aspect_ratio", "1:1") in ("1:1", "N/A")),
        ("扫描方式", "progressive" if v.get("field_order", "progressive") in ("progressive", "unknown") else v.get("field_order"),
         v.get("field_order", "progressive") in ("progressive", "unknown")),
        ("尺寸", f"{w}x{h}", MIN_EDGE <= w <= MAX_W and MIN_EDGE <= h <= MAX_H),
        ("画幅比", f"{float(aspect):.3f}:1", MIN_ASPECT <= aspect <= MAX_ASPECT),
        ("帧率", f"{fps:.3f}", 0 < fps <= MAX_FPS),
        ("时长", f"{dur:.3f}s", MIN_SECONDS <= dur <= MAX_SECONDS),
        ("文件大小", f"{size/1e6:.2f}MB", size <= MAX_BYTES),
        ("音轨", a["codec_name"] if a else "无(静音片)",
         a is None or (a["codec_name"] == "aac" and a.get("profile") == "LC")),
        ("首帧非黑", f"YAVG={luma:.1f}", luma > 16),
        ("faststart", "moov 在前" if moov_first(path) else "moov 在后", moov_first(path)),
    ]

    bad = 0
    for name, value, good in checks:
        print(f"  {'PASS' if good else 'FAIL'}  {name}: {value}")
        bad += 0 if good else 1
    print(f"\n{len(checks) - bad}/{len(checks)} 通过")
    return 0 if bad == 0 else 1


def moov_first(path: Path) -> bool:
    """faststart 检查:直接扫前 512KB 里 moov 是否早于 mdat。"""
    head = path.read_bytes()[:524288]
    m, d = head.find(b"moov"), head.find(b"mdat")
    return m != -1 and (d == -1 or m < d)


# 分享卡规格。1200x630 是 Open Graph 的事实标准(Slack/Discord/LinkedIn/Facebook 按它排版),
# 1280x640 是 GitHub social preview 的原生尺寸且有 1MB 硬上限。
# X 的 summary_large_image 按 2:1 居中裁,喂 1200x630 只会切掉上下各 15px,不用单独出图。
CARDS = {
    "og": (1200, 630, 5_000_000),
    "github": (1280, 640, 1_000_000),
}


def card(src: Path, out: Path, kind: str, top: int, bottom: int,
         anchor: str, quality: int) -> int:
    """从一张真实游戏帧裁出分享卡。

    只裁不画:卡片上不烧任何文字。标题和描述由 og:title / og:description 提供,
    平台会把它们排在图旁边,烧进图里既是重复,第一眼也是宣传物的味道。

    --bottom 是这里唯一需要动脑的参数:界面底部那排指令按钮被卡片边缘拦腰切一半,
    会在卡上留一条半截矩形的杂条。把整排排除掉,再靠横向裁切补回比例,比切一半好看。
    """
    w, h, limit = CARDS[kind]
    info = probe(src)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    sw, sh = int(v["width"]), int(v["height"])

    uy, uh = top, sh - top - bottom
    if uh <= 0:
        sys.exit("--top/--bottom 把源图裁没了")
    # 在可用区域里取目标比例的最大矩形:先试满宽,不够高就改成裁宽度。
    ch = round(sw * h / w)
    if ch <= uh:
        cw, cy = sw, uy
    else:
        cw, ch, cy = round(uh * w / h), uh, uy
    cx = {"left": 0, "center": (sw - cw) // 2, "right": sw - cw}[anchor]

    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [need("ffmpeg"), "-y", "-i", str(src), "-vf",
         f"crop={cw}:{ch}:{cx}:{cy},scale={w}:{h}:flags=lanczos",
         "-q:v", str(quality), str(out)],
        check=True, capture_output=True,
    )
    size = out.stat().st_size
    luma = first_frame_luma(out)
    good = size <= limit and luma > 16
    print(f"  {'PASS' if good else 'FAIL'}  {out.name}: {w}x{h}  "
          f"{size/1e3:.0f}KB (上限 {limit/1e6:.0f}MB)  YAVG={luma:.1f}  "
          f"源 {sw}x{sh} 裁 {cw}x{ch}@{cx},{cy}")
    return 0 if good else 1


def contact_sheet(src: Path, out_dir: Path, every: float) -> None:
    """每隔 N 秒抽一帧存成 jpg,用来肉眼挑剪切点——不猜,看着选。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [need("ffmpeg"), "-y", "-i", str(src), "-vf",
         f"fps=1/{every},scale=480:-2", "-q:v", "4",
         str(out_dir / "t%03d.jpg")],
        check=True, capture_output=True,
    )
    shots = sorted(out_dir.glob("t*.jpg"))
    print(f"{len(shots)} 张 → {out_dir}  (第 n 张 ≈ 第 {every}*(n-1) 秒)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("encode")
    e.add_argument("src", type=Path)
    e.add_argument("--out", type=Path, required=True)
    e.add_argument("--start", type=float, default=None, help="从源片第几秒开始")
    e.add_argument("--duration", type=float, default=20.0)
    e.add_argument("--fps", type=int, default=30)
    e.add_argument("--crf", type=int, default=20)
    e.add_argument("--keep-audio", action="store_true")

    v = sub.add_parser("verify")
    v.add_argument("src", type=Path)

    k = sub.add_parser("card")
    k.add_argument("src", type=Path, help="一张真实游戏帧(jpg/png/mp4 首帧)")
    k.add_argument("--out", type=Path, required=True)
    k.add_argument("--kind", choices=sorted(CARDS), default="og")
    k.add_argument("--top", type=int, default=0, help="从源图顶部排除多少像素")
    k.add_argument("--bottom", type=int, default=0, help="从源图底部排除多少像素")
    k.add_argument("--anchor", choices=("left", "center", "right"), default="center",
                   help="需要横向裁切时靠哪边;标题在左上角就用 left")
    k.add_argument("--quality", type=int, default=3, help="ffmpeg -q:v,越小越好")

    c = sub.add_parser("contact-sheet")
    c.add_argument("src", type=Path)
    c.add_argument("--out", type=Path, required=True)
    c.add_argument("--every", type=float, default=1.0)

    args = ap.parse_args()
    if args.cmd == "encode":
        encode(args.src, args.out, args.start, args.duration,
               args.fps, args.crf, args.keep_audio)
        print(f"→ {args.out}\n")
        return verify(args.out)
    if args.cmd == "verify":
        return verify(args.src)
    if args.cmd == "card":
        return card(args.src, args.out, args.kind, args.top, args.bottom,
                    args.anchor, args.quality)
    contact_sheet(args.src, args.out, args.every)
    return 0


if __name__ == "__main__":
    sys.exit(main())
