import Viewer from './viewer.js';




(async () => {
    try {
        // 从 WebView 环境中获取 VS Code API
        const vscode = acquireVsCodeApi();

        document.addEventListener('click', (event) => {
            const target = event.target.closest('.file-link');
            if (target) {
                event.preventDefault();
                const filePath = target.getAttribute('data-file-path');
                const lineNumber = parseInt(target.getAttribute('data-line-number'), 10);

                console.log(filePath, lineNumber);

                vscode.postMessage({ command: 'openFile', filePath, lineNumber });
            }
        });

        // 初始化 Viewer 并启动
        const viewer = new Viewer('glCanvas');
        await viewer.start(); // 确保 start() 异步逻辑完成

    } catch (error) {
        const errorOutput = document.getElementById('errorOutput');
        errorOutput.style.display = 'block';
        errorOutput.textContent = error.message || 'Unknown error occurred';

        // 使用 HTML 渲染错误日志
        errorOutput.innerHTML = `${errorOutput.textContent}`;

        console.error(error);
    }
})();