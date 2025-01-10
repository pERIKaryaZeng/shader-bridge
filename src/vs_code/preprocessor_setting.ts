import { ValueReferenceTable, ValueReference,  ValueReferenceManager } from './value';

export const preprocessorSetting = {
    // 如果为 true，会使用此channel定义的最小location作为默认mainImage的输出，以及其他channel的默认读取
    useMinDefinedLocationAsDefault: true,
    prefix: "glsl_"

}

const filterValueReference: ValueReference = {
    type: "enum",
    options: {
        nearest: "Nearest",
        Nearest: "Nearest",
        NEAREST: "Nearest",
        linear: "Linear",
        Linear: "Linear",
        LINEAR: "Linear",
    }
};

const wrapModeValueReference: ValueReference = {
    type: "enum",
    options: {
        repeat: 'Repeat',
        Repeat: 'Repeat',
        REPEAT: 'Repeat',
        mirroredRepeat: 'MirroredRepeat',
        MirroredRepeat: 'MirroredRepeat',
        mirrored_repeat: 'MirroredRepeat',
        MIRRORED_REPEAT: 'MirroredRepeat',
        clampToEdge: 'ClampToEdge',
        ClampToEdge: 'ClampToEdge',
        clamp_to_edge: 'ClampToEdge',
        CLAMP_TO_EDGE: 'ClampToEdge',
    }
};

const channelSettingsReferenceTable: ValueReferenceTable = {
    use_last_buffer: {type: "boolean"},
    width: {type: "string"},
    hight: {type: "string"},
    min_filter: filterValueReference,
    mag_filter: filterValueReference,
    wrap_mode: wrapModeValueReference,
    wrap_mode_s: wrapModeValueReference,
    wrap_mode_t: wrapModeValueReference,
    wrap_mode_r: wrapModeValueReference,
}

const upperCaseChannelSettingsReferenceTable = Object.entries(channelSettingsReferenceTable).reduce(
    (acc, [key, value]) => {
      acc[key.toUpperCase()] = value;
      return acc;
    },
    {} as ValueReferenceTable
);

// 将下划线后的首字母变为大写
const camelCaseChannelSettingsReferenceTable = Object.entries(channelSettingsReferenceTable).reduce(
    (acc, [key, value]) => {
      const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelCaseKey] = value;
      return acc;
    },
    {} as ValueReferenceTable
);

export const channelSettingsReferenceManager = new ValueReferenceManager([
    {
        table: channelSettingsReferenceTable,
        transformKey: (key: string) => key
    }, {
        table: upperCaseChannelSettingsReferenceTable,
        transformKey: (key: string) => key.toUpperCase()
    }, {
        table: camelCaseChannelSettingsReferenceTable, 
        transformKey: 
            (key: string) => key.replace(/^([A-Z])/, (_, letter) => letter.toLowerCase()) // 将首字母小写}
    }
]);