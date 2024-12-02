export default class ShaderProgram {
    constructor(gl, vertexShader, fragmentShader) {
        this.gl = gl;
        this.program = this.createProgram(vertexShader, fragmentShader);
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
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

    use() {
        this.gl.useProgram(this.program);
    }

    getUniformLocation(name) {
        return this.gl.getUniformLocation(this.program, name);
    }

    setUniform1f(name, value) {
        const location = this.getUniformLocation(name);
        this.gl.uniform1f(location, value);
    }
}
