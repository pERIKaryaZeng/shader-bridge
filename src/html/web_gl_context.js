export default class WebGLContext {
    constructor(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new Error(`Canvas with ID "${canvasId}" not found`);
        }
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
    }

    getGL() {
        return this.gl;
    }
}
