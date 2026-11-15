// 过场字幕的节拍（纯逻辑，无 DOM）。
// 一段过场 6～12 秒，字幕却常有三五句、一两百字：按片长硬排会前紧后松、读不完。这里的规矩是——
//   1. 第 i 句最早在 cues[i] 秒出现（它所属镜头的起点或人声起点），不跑到画面前面；
//   2. 每句至少停 readMs(text) 毫秒，读够了、且影像走到下一句的时间点，才换句；
//   3. 还没读够时，影像不许演过这句所属镜头的结尾 ends[i]，也不许先响下一句的人声：走到那里就停住等。
export const SUB_CPS = 7; // 过场字幕的阅读速度：字／秒
export const SUB_MIN_MS = 1800;
export const SUB_MAX_MS = 10000;
export const HOLD_LEAD = 0.15; // 提前这么多秒停住，免得下一个镜头的头一帧闪出来

export function readMs(text) {
  const n = [...String(text ?? '')].length;
  return Math.round(Math.min(SUB_MAX_MS, Math.max(SUB_MIN_MS, 800 + (n / SUB_CPS) * 1000)));
}

// cut：{ cues, ends, seconds }；i：屏上这一句；t：影像当前秒数；shownMs：这一句已经在屏上停了多久（暂停不算）
// 返回 'next'（换下一句）、'hold'（停住影像等玩家读完）、'play'（照常演）
export function cutStep(cut, i, t, shownMs, text) {
  const next = cut.cues[i + 1];
  const read = shownMs >= readMs(text);
  if (next !== undefined && read && t >= next) return 'next';
  if (read) return 'play';
  let gate = cut.ends?.[i] ?? Infinity;
  if (next === undefined && gate >= cut.seconds - 0.3) return 'play'; // 最后一句落在末镜：演完停在末帧，本来就等点击
  if (next !== undefined && next > cut.cues[i]) gate = Math.min(gate, next);
  return t >= gate - HOLD_LEAD ? 'hold' : 'play';
}
