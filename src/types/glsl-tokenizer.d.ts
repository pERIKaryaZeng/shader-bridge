declare module 'glsl-tokenizer' {
    interface Token {
        type: string;
        data: string;
        position: [number, number, number];
    }

    export function tokenize(input: string): Token[];
}