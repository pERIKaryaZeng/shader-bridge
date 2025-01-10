export const globalExpressionContext = {
    vh: 1024,
    vw: 1024,
}

export class Expression {
    private fn: Function;
    private context: any;
    private result: any;

    constructor(expression: string, context: any) {
        this.context = context;
        this.fn = new Function('context', `with (context) { return ${expression}; }`);
        this.update();
    }

    public update(){
        console.log('Calculating expression...');
        try {
            const result = this.fn(this.context);
            console.log(`Result: ${result}`);
            this.result = result;
        } catch (e) {
            console.error('Error calculating expression:', e);
        }
    }

    public get(): any{
        return this.result;
    }
}