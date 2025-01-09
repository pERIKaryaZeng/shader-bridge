export type Value = number | string | boolean;

export type ValueReference = 
    {type: "number", default: number} |
    {type: "string", default: string} |
    {type: "boolean", default: boolean} |
    {type: "enum", default: string, options: string[]};

export type ValueReferenceTable = {[key: string]: ValueReference}

export function verifyInputValue(valueType: string, valueString: string, referenceTable: ValueReferenceTable): Value {
    const valueReference = referenceTable[valueType];
    if (!valueReference) throw new Error(`Invalid setting type: ${valueType}.`); 
    switch (valueReference.type) {
        case "number":
            return Number(valueString);
        case "string":
            return valueString;
        case "boolean":
            return valueString === "true";
        case "enum":
            if (valueReference.options.includes(valueString)) {
                return valueString;
            }
            throw new Error(`The options [${valueReference.options}] of value type "${valueReference.type}" does not contain "${valueString}".`);
        default:
            throw new Error(`Invalid value type "${valueType}".`);
    }
}