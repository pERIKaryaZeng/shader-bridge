export type Value = number | string | boolean;

export type ValueReference =
    { type: "number", default?: number } |
    { type: "string", default?: string } |
    { type: "boolean", default?: boolean } |
    { type: "enum", default?: string, options: { [key: string]: Value }};

export type ValueReferenceTable = { [key: string]: ValueReference }

// export function verifyInputValue(valueType: string, valueString: string, referenceTable: ValueReferenceTable): Value {
//     const valueReference = referenceTable[valueType];
//     if (!valueReference) throw new Error(`Invalid setting type: ${valueType}.`);
//     switch (valueReference.type) {
//         case "number":
//             return Number(valueString);
//         case "string":
//             return valueString;
//         case "boolean":
//             return valueString === "true";
//         case "enum":
//             if (valueReference.options.includes(valueString)) {
//                 return valueString;
//             }
//             throw new Error(`The options [${valueReference.options}] of value type "${valueReference.type}" does not contain "${valueString}".`);
//         default:
//             throw new Error(`Invalid value type "${valueType}".`);
//     }
// }

type ValueReferenceTableInfo = {
    table: ValueReferenceTable;
    transformKey: (key: string) => string
};

export class ValueReferenceManager {
    // 存储参考表及其处理函数
    private valueReferenceTableInfos: ValueReferenceTableInfo[] = [];

    constructor(valueReferenceTableInfos: ValueReferenceTableInfo[]) {
        // 将初始表加入参考表列表
        this.valueReferenceTableInfos = valueReferenceTableInfos;
    }

    // 添加额外的参考表
    public addReferenceTable(
        valueReferenceTableInfo: ValueReferenceTableInfo
    ): void {
        this.valueReferenceTableInfos.push(valueReferenceTableInfo);
    }

    // 验证值类型和内容
    public verify(valueType: string, valueString: string): Value {
        let valueReference: ValueReference | undefined;

        // 在所有参考表中查找对应的键
        for (const { table, transformKey } of this.valueReferenceTableInfos) {
            const transformedKey = transformKey(valueType);
            valueReference = table[transformedKey];
            if (valueReference) break;
        }

        if (!valueReference) {
            throw new Error(`Invalid setting type: "${valueType}".`);
        }

        // 根据 valueReference.type 验证并返回正确类型的值
        switch (valueReference.type) {
            case "number":
                const numberValue = Number(valueString);
                if (isNaN(numberValue)) {
                    throw new Error(`Invalid number value: "${valueString}".`);
                }
                return numberValue;

            case "string":
                return valueString;

            case "boolean":
                if (valueString !== "true" && valueString !== "false") {
                    throw new Error(`Invalid boolean value: "${valueString}".`);
                }
                return valueString === "true";

            case "enum":
                const valueInfo = valueReference.options[valueString];
                if (valueInfo === undefined) {
                    throw new Error(
                        `Invalid enum value: "${valueString}". Allowed values are [${Object.keys(valueReference.options).join(", ")}].}].`
                    );
                }
                return valueInfo;
            default:
                throw new Error(`Invalid value type "${valueType}".`);
        }
    }

    // 默认的键转换函数（大小写无关）
    private lowercaseTransform(key: string): string {
        return key.toLowerCase();
    }
}