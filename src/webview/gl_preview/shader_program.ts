import Shader from './shader';

export default class ShaderProgram {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;

    constructor(gl: WebGLRenderingContext, vertexShader: Shader, fragmentShader: Shader) {
        this.gl = gl;
        this.program = this.createProgram(vertexShader, fragmentShader);
    }

    private createProgram(vertexShader: Shader, fragmentShader: Shader): WebGLProgram {
        const program = this.gl.createProgram();
        if (!program) {
            throw new Error("Failed to create WebGL program.");
        }

        this.gl.attachShader(program, vertexShader.get());
        this.gl.attachShader(program, fragmentShader.get());
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error(`Program linking error: ${error}`);
        }

        return program;
    }

    public get(): WebGLProgram {
        return this.program;
    }

    public use(): void {
        this.gl.useProgram(this.program);
    }

    public getUniformLocation(name: string): WebGLUniformLocation | null {
        return this.gl.getUniformLocation(this.program, name);
    }
}
