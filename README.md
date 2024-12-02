# Shader Bridge

Shader Bridge 是一个 Visual Studio Code 插件，专为 OpenGL ES (GLES) 开发者设计。此插件提供了代码可视化和预览功能，还支持将当前项目转换为 Android Studio 项目，方便在 Android 平台进行无缝开发。

---

## Features

- **GLSL Shader 预览**：直接在 VS Code 中可视化 GLSL Shader 代码的效果。
- **Android Studio 项目转换**：将现有项目一键转换为 Android Studio 项目。
- **增强的开发体验**：支持在 GLES 环境中快速调试和开发。

示例截图：

\!\[GLSL 预览示例\]\(images/glsl-preview.png\)

---

## Requirements

- Visual Studio Code 版本 `^1.95.0`
- 必须安装 GLES 相关开发环境（如 OpenGL ES 运行时库）。
- Android Studio （如果使用项目转换功能）。

---

## Usage

1. 打开一个 GLSL 文件（扩展名为 `.glsl`）。
2. 在文件编辑器中右键，选择 **Run GLSL File**。
3. 在 WebView 面板中查看 Shader 的实时渲染效果。

---

## Extension Settings

此插件不需要额外的配置，所有功能可直接使用。

---

## Known Issues

- 在低性能计算机上，复杂 Shader 的渲染可能较慢。
- 某些 Shader 可能与 GLES 的特定版本不兼容。

---

## Release Notes

### 0.0.1

- 添加了基础的 GLSL 预览功能。
- 支持 GLSL 文件的右键菜单操作。

---

## Contributing

欢迎为此插件贡献代码或提出改进建议！请访问 [GitHub 仓库](https://github.com/your-repo-link) 提交 Issue 或 Pull Request。

---

## License

Shader Bridge 遵循 [MIT License](https://opensource.org/licenses/MIT)。