export default class Expression {
    private fn: Function;
    private context: any;
    private expression: string;
    private result: any;

    constructor(expression: string, context: any) {
        this.expression = expression;
        this.fn = new Function('context', `with (context) { return ${expression}; }`);
        this.update(context);
    }

    public update(context: any){
        console.log('Calculating expression...');
        try {
            const result = this.fn(context);
            console.log(`Result: ${result}`);
            this.result = result;
        } catch (e) {
            console.error('Error calculating expression:', e);
        }
    }

    public get(context: any = null): any{
        if (context) {
            this.update(context);
        }
        return this.result;
    }
}