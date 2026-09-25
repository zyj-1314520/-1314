# 人杰地灵画布更新

这是从桌面上的“人灵地杰AI无限画布(便携版)”中提取出的画布源码项目，面向后续桌面端更新。

## 源码来源

原始源码位置：

`SU工作台/renling_su/vendor/cam_wheel/web_canvas_tool/`

当前项目只保留画布工具本身，不包含桌面便携版的 Electron 运行时、用户数据、日志和发布包。

## 当前能力

- 多图片导入与素材列表
- 画布拖拽、平移、缩放和网格吸附
- 单选与框选
- 图片位置、尺寸、旋转和裁剪参数编辑
- 拖框裁剪
- 网格切片与参考线切片
- 直线切割
- 合并导出和逐张导出
- JPG / PNG 导出

## 运行

直接打开 `standalone.html` 即可运行独立画布。

也可以在项目目录启动静态文件服务器：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080/standalone.html`。

## Git

```bash
git init
git add .
git commit -m "feat: initialize renling canvas update"
```
