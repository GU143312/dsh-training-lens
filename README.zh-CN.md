# Training Lens · 训练视窗

为 **DeepSeek Harness（DSH）** 提供简洁的本地训练监控。直接读取训练器已经写好的 TensorBoard 标量，不需要改训练代码，也不依赖 TensorBoard 网页启动。

[English](README.md)

![Training Lens 合成数据演示](docs/preview.jpg)

截图使用生成的演示数据，不代表真实训练结果。

## 看什么

- 自选主要 / 辅助指标：奖励、验证损失、准确率、学习率以及任意自定义标量。
- 自选“越高越好 / 越低越好”；默认不预设方向，显示历史范围。
- 原始数值、可选 EMA 平滑、指标自己的记录 step、可展开的全部标量和异常值提示。
- 中英文切换、窄屏布局、运行切换、每五秒自动刷新。

## 安装

需要 DSH 0.2.1-rc.2（已测试的目标版本）、Node 22+，以及已安装 TensorBoard 的 Python 3.10+ 训练环境。

```sh
dsh plugin --profile desktop add https://github.com/GU143312/dsh-training-lens/releases/download/v0.1.0/dsh-training-lens-0.1.0.tgz
```

也可以从源码安装；包内是可直接运行的 JavaScript，不需要安装时构建：

```sh
dsh plugin --profile desktop add github:GU143312/dsh-training-lens#v0.1.0
```

安装后在方便的时候重载插件或重启 DSH。`desktop` 可换成自己的 profile。GitHub 安装包与 npm 发布是独立渠道；npm 尚未发布时请使用上面命令。

在 DSH 中说：

> 请用 training_lens 打开我的 TensorBoard 日志，目录是「日志目录的绝对路径」，Python 是「训练环境 Python 的完整路径」。

Windows 的解释器通常在 `.venv\Scripts\python.exe`；Linux/macOS 通常在 `.venv/bin/python`。插件返回一个本机网页地址，打开后选择运行、主要指标和改善方向。

之后可以说“查看训练视窗状态”或“关闭训练视窗”。关闭的只是监控进程，训练不受影响。插件卸载、重载或 DSH 退出时，自己启动的监控会被清理。每个插件实例同时管理一个监控；更换目录或解释器前请先关闭。

## 依赖与配置

优先复用已有训练 Python。缺少 TensorBoard 时，在源码目录用该解释器执行 `python -m pip install -r requirements.txt`。插件不会自动安装或修改依赖，也不读取账号、凭证或训练模型。

默认自动选择空闲端口，仅监听 `127.0.0.1`；指定端口被占用时会报错，不会终止其他服务。可在 profile 的 `cordis.patch.yml` 为 `training-lens` 设置 `python`、`logdir`、`port`、`staleSeconds`、`startupTimeoutMs`，示例见 [英文说明](README.md#configuration)。

## 如何理解页面

- 状态灯只反映日志新鲜度，不证明训练进程仍然健康。达到目标 step / epoch 也不代表模型已保存或训练成功。
- 各指标可能有不同的更新频率，卡片注明自己的 step。普通训练不假设 step 就是 epoch；仅在已知日志约定下展示配置目标。
- 不从奖励推算成功率，不从损失下降宣称泛化改善。不同指标的图表纵轴独立。
- 非有限值留空并断开曲线。长序列仅为绘图降采样，卡片统计仍使用完整已读序列。
- 支持普通 scalar 和 TF2 scalar-plugin tensor。超大的混合媒体日志可能占用较多内存，请选择明确的训练日志目录。
- 日志留在本机，无遥测、无云端上传。远程 DSH 的网页运行在远程主机，请使用已有 SSH / 编辑器端口转发。

## 开发与许可

`npm ci --ignore-scripts`、`npm run check`、`npm test`，以及 `python -m unittest discover -s tests -p 'test_*.py' -v`。设置 `TRAINING_LENS_TEST_PYTHON` 后启用真实子进程生命周期测试；缺少可选 Python 依赖时，相关测试明确跳过。测试不启动真实训练。

MIT 开源许可；依赖保留各自许可证。安装包只包含必要的代码、静态资源和说明，不包含运行数据、个人目录、模型或原项目文件。
