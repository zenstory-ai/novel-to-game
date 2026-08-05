# HY3D 风格化禽龙试验

## 结论

- HY3D 可以显著改善程序网格最突出的尾根断裂与躯干轮廓问题。
- 写实输入会把皮肤微纹理、皱褶和笨重比例一起固化，结果不适合当前游戏的风格化低多边形方向。
- 改用大色块、宽表面、克制纹理的风格化输入后，左右、正面和背面轮廓基本一致，尾根连续，视觉方向通过。
- 当前产物没有骨骼与动画，只能作为静态资产或后续动画工程的母版，尚不能直接替换正在行走的主恐龙。

## 生成参数

- 服务：腾讯混元 3D 内部版
- 模型：`image2ModelV3.5`
- 输入：单张风格化禽龙参考图
- 母版面数：`500000`
- 材质：PBR

## 游戏版处理

- `glTF-Transform weld`
- `glTF-Transform simplify --ratio 0.102 --error 0.02`
- 发布结果：`24996` triangles，`23728` vertices
- 发布纹理：`1024x1024`，WebP，quality `82`
- 文件体积：`49.33 MB` → `1.09 MB`
- 三张 PBR 纹理含 mipmap 的估算 GPU 占用：约 `64 MiB`（2K）→ `16 MiB`（1K）
- 同机位 2K/1K 软件渲染全帧 RGB RMS 差异：`1.57`
- 同机位 51K/25K 软件渲染全帧 RGB RMS 差异：`1.66`
- glTF 校验：无错误
- 已知警告：网格没有预存 tangent，运行时需生成 tangent space

## 证据

- `reference-stylized.png`：最终风格化输入
- `render-contact-sheet.png`：游戏版左、右、正、背四视图
- `render-contact-sheet-realistic-baseline.png`：写实输入基线
- `render-texture-2k-vs-1k.png`：2K 与 1K 纹理同机位对比
- `render-geometry-51k-vs-25k.png`：51K 与 25K 网格同机位对比
- `asset.sha256`：游戏版 GLB 校验值

## 未解决项

1. 单图重建令左右肢体姿态高度重合，不利于直接绑骨。
2. HY3D 输出没有 skeleton / animation。
3. 内部自动绑骨页面明确提示非人形角色不受支持，不能把恐龙动画视为已解决。
4. 接入游戏前需要做异步加载、失败回退和动态表现验证。

## 发布成本评估

- 当前不含 GLB 的构建产物：`703496` bytes raw，约 `183866` bytes gzip。
- 加入 25K / 1K GLB 后：`1792504` bytes raw，约 `1002031` bytes gzip。
- GLB 自身：`1089008` bytes raw，约 `818165` bytes gzip。
- 三张 1K PBR 纹理含 mipmap 约占 `16 MiB` GPU 内存；基础网格约 `0.91 MB`，
  六组运行时 morph buffer 计入后共享 GPU 估算约 `19 MiB`。
- 同一 GLB 只加载一次并共享 geometry、material、texture 时，五只实例不会把下载和 GPU 资源乘以五；三角形提交约为 `124980` 每帧。
- 正式接入必须采用延迟加载和单例缓存，不能让 GLB 阻塞首个可交互画面，也不能为每只恐龙重复调用 `GLTFLoader.load`。
