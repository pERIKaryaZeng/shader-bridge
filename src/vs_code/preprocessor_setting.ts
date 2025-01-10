import { Value, ValueReferenceTable, ValueReference, ValueReferenceManager } from './value';

export const preprocessorSetting = {
    // 如果为 true，会使用此channel定义的最小location作为默认mainImage的输出，以及其他channel的默认读取
    useMinDefinedLocationAsDefault: true,
    prefix: "glsl_"

}

function addOtherCases(baseOptions: { [key: string]: Value }) : ValueReference {
    const resultOptions: { [key: string]: Value } = { ...baseOptions };

    Object.keys(baseOptions).forEach((key) => {
        const value = baseOptions[key];

        // 生成驼峰（camelCaseKey）
        const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        // 生成首字母大写驼峰（PascalCaseKey）
        const pascalCaseKey = camelCaseKey.charAt(0).toUpperCase() + camelCaseKey.slice(1);

        // 生成下划线全小写（snake_case_key）
        const snakeCaseKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        // 生成下划线全大写（SNAKE_CASE_KEY）
        const snakeCaseUpperKey = snakeCaseKey.toUpperCase();

        // 将映射添加到结果表
        if (!resultOptions[camelCaseKey]) {
            resultOptions[camelCaseKey] = value;
        }
        if (!resultOptions[pascalCaseKey]) {
            resultOptions[pascalCaseKey] = value;
        }
        if (!resultOptions[snakeCaseKey]) {
            resultOptions[snakeCaseKey] = value;
        }
        if (!resultOptions[snakeCaseUpperKey]) {
            resultOptions[snakeCaseUpperKey] = value;
        }
    });

    return {
        type: "enum",
        options: resultOptions
    };
}

const filterValueReference = addOtherCases({
    nearest: "nearest",
    linear: "linear",
});

const wrapModeValueReference = addOtherCases({
    repeat: 'repeat',
    mirrored_repeat: 'mirrored_repeat',
    clamp_to_edge: 'clamp_to_edge',
});

const channelSettingsReferenceTable: ValueReferenceTable = (() => {
    // 必须是snakeCaseKey 或 camelCaseKey
    const baseTable: ValueReferenceTable = {
        use_last_buffer: { type: "boolean" },
        width: { type: "string" },
        height: { type: "string" },
        length: { type: "string" },
        min_filter: filterValueReference,
        mag_filter: filterValueReference,
        wrap_mode: wrapModeValueReference,
        wrap_mode_s: wrapModeValueReference,
        wrap_mode_t: wrapModeValueReference,
        wrap_mode_r: wrapModeValueReference,
    };

    const resultTable: ValueReferenceTable = { ...baseTable };

    Object.keys(baseTable).forEach((key) => {
        // 生成驼峰（camelCaseKey）
        const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        // 生成首字母大写驼峰（PascalCaseKey）
        const pascalCaseKey = camelCaseKey.charAt(0).toUpperCase() + camelCaseKey.slice(1);

        // 生成下划线全小写（snake_case_key）
        const snakeCaseKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        // 生成下划线全大写（SNAKE_CASE_KEY）
        const snakeCaseUpperKey = snakeCaseKey.toUpperCase();

        // 将映射添加到结果表
        if (!resultTable[camelCaseKey]) {
            resultTable[camelCaseKey] = { type: "mapping", key };
        }
        if (!resultTable[pascalCaseKey]) {
            resultTable[pascalCaseKey] = { type: "mapping", key };
        }
        if (!resultTable[snakeCaseKey]) {
            resultTable[snakeCaseKey] = { type: "mapping", key };
        }
        if (!resultTable[snakeCaseUpperKey]) {
            resultTable[snakeCaseUpperKey] = { type: "mapping", key };
        }
    });

    return resultTable;
})();

export const channelSettingsReferenceManager = new ValueReferenceManager(channelSettingsReferenceTable);