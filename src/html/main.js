import Viewer from './viewer.js';

const vertexShaderSource = `
    attribute vec4 a_position;
    void main() {
        gl_Position = a_position;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform float u_time;
    void main() {
        gl_FragColor = vec4(abs(sin(u_time)), 0.5, abs(cos(u_time)), 1.0);
    }
`;

const viewer = new Viewer('glCanvas', vertexShaderSource, fragmentShaderSource);
viewer.start();