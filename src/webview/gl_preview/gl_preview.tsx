import Viewer from './viewer.js';

// 获取 VS Code API 类型（可选）
declare function acquireVsCodeApi(): any;

(async () => {
    try {
        // 从 WebView 环境中获取 VS Code API
        const vscode = acquireVsCodeApi();

        // 添加点击事件监听器
        document.addEventListener('click', (event: MouseEvent) => {
            const target = (event.target as HTMLElement)?.closest('.file-link') as HTMLElement | null;
            if (target) {
                event.preventDefault();

                const filePath = target.getAttribute('data-file-path');
                const lineNumber = parseInt(target.getAttribute('data-line-number') || '', 10);

                if (filePath) {
                    console.log(filePath, lineNumber);

                    vscode.postMessage({
                        command: 'openFile',
                        filePath,
                        lineNumber
                    });
                }
            }
        });

        // 初始化 Viewer 并启动
        const viewer = new Viewer('glCanvas');
        await viewer.start(); // 确保 start() 异步逻辑完成
    } catch (error) {
        const errorOutput = document.getElementById('errorOutput') as HTMLElement;

        if (errorOutput) {
            errorOutput.style.display = 'block';
            errorOutput.textContent = (error as Error).message || 'Unknown error occurred';

            // 使用 HTML 渲染错误日志
            errorOutput.innerHTML = `${errorOutput.textContent}`;
        }

        console.error(error);
    }
})();
