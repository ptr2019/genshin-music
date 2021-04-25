let ComposerSettings = {
    settingVesion: 2,
    bpm: {
        name: "Bpm",
        type: "number",
        songSetting: true,
        threshold: [0, 1000],
        value: 220
    },
    beatMarks: {
        name: "Beat marks",
        type: "select",
        songSetting: false,
        value: 0,
        options: [
            0,
            3,
            4
        ]
    },
    instrument: {
        name: "Instrument",
        type: "select",
        songSetting: false,
        value: 0,
        options: [
            "lyre"
        ]
    },
    pitch: {
        name: "Pitch",
        type: "select",
        songSetting: true,
        value: "C",
        options: [
            "C",
            "Db",
            "D",
            "Eb",
            "E",
            "F",
            "Gb",
            "G",
            "Ab",
            "A",
            "Bb",
            "B",
        ]
    },
    columnsPerCanvas:{
        name: "Number of visible columns",
        type: "select",
        songSetting: false,
        value: 35,
        options: [
            20,
            25,
            30,
            35,
            40,
            45,
            50
        ]
    }
}
let MainPageSettings = {
    settingVesion : 0,
    keyboardSize: {
        name: "Keyboard size",
        type: "number",
        songSetting: false,
        value: 100,
        threshold: [50, 200]
    },
    instrument: {
        name: "Instrument",
        type: "select",
        songSetting: false,
        value: 0,
        options: [
            "lyre"
        ]
    },
    pitch: {
        name: "Pitch",
        type: "select",
        songSetting: true,
        value: "C",
        options: [
            "C",
            "Db",
            "D",
            "Eb",
            "E",
            "F",
            "Gb",
            "G",
            "Ab",
            "A",
            "Bb",
            "B",
        ]
    },
}
export {
    ComposerSettings,
    MainPageSettings
}