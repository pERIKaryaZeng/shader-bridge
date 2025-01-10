export type Value = number | string | boolean;

export type ValueReference =
    { type: "number", default?: number } |
    { type: "string", default?: string } |
    { type: "boolean", default?: boolean } |
    { type: "enum", default?: string, options: { [key: string]: Value }} |
    { type: "mapping", key: string };

export type ValueReferenceTable = { [key: string]: ValueReference }

export class ValueReferenceManager {
    // 存储参考表及其处理函数
    private valueReferenceTable: ValueReferenceTable;

    constructor(valueReferenceTable: ValueReferenceTable) {
        // 将初始表加入参考表列表
        this.valueReferenceTable = valueReferenceTable;
    }

    // 验证值类型和内容
    public verify(keyName: string, valueString: string): {keyName: string, value: Value} {
        let valueReference = this.valueReferenceTable[keyName];

        if (valueReference && valueReference.type === "mapping") {
            keyName = valueReference.key;
            valueReference = this.valueReferenceTable[keyName];
        }

        if (!valueReference) {
            throw new Error(`Invalid setting type: "${keyName}".`);
        }

        // 根据 valueReference.type 验证并返回正确类型的值
        switch (valueReference.type) {
            case "number":
                const numberValue = Number(valueString);
                if (isNaN(numberValue)) {
                    throw new Error(`Invalid number value: "${valueString}".`);
                }
                return {keyName: keyName, value: numberValue};

            case "string":
                return {keyName: keyName, value: valueString};

            case "boolean":
                if (valueString !== "true" && valueString !== "false") {
                    throw new Error(`Invalid boolean value: "${valueString}".`);
                }
                return {keyName: keyName, value: valueString === "true"};

            case "enum":
                const valueInfo = valueReference.options[valueString];
                if (valueInfo === undefined) {
                    throw new Error(
                        `Invalid enum value: "${valueString}". Allowed values are [${Object.keys(valueReference.options).join(", ")}].}].`
                    );
                }
                return {keyName: keyName, value: valueInfo};
            default:
                throw new Error(`Invalid value type "${keyName}".`);
        }
    }

}