
import { SimpleMenu } from "components/SimpleMenu"
import './MidiSetup.css'
import { appName } from "appConfig"
import { getMIDISettings } from "lib/BaseSettings"
import BaseNote from "components/BaseNote"
import { LAYOUT_IMAGES, MIDI_STATUS } from "appConfig"
import React, { Component } from 'react'
import { audioContext, instruments, isMidiAvailable } from "appConfig"
import Instrument from "lib/Instrument"
import Shortcut from "./Shortcut"
import LoggerStore from "stores/LoggerStore"
export default class MidiSetup extends Component {
    constructor(props) {
        super(props)
        this.state = {
            settings: getMIDISettings(),
            instrument: new Instrument(),
            selectedNote: null,
            selectedShortcut: null,
            sources: [],
            selectedSource: undefined
        }
        this.audioContext = audioContext
        this.mounted = true
        this.MidiAccess = undefined
    }

    componentDidMount() {
        this.init()
    }
    componentWillUnmount() {
        const { sources } = this.state
        this.mounted = false
        if (this.MidiAccess) this.MidiAccess.onstatechange = null
        //TODO connect to saved up keyboard
        sources?.forEach(source => {
            source.onmidimessage = null
        })
        if (this.selectedSource) this.selectedSource.onmidimessage = null
    }
    init = () => {
        this.loadInstrument(instruments[0])
        if (isMidiAvailable) {
            navigator.requestMIDIAccess().then(this.initMidi, () => {
                LoggerStore.error('MIDI permission not accepted')
            })
        } else {
            LoggerStore.error('MIDI is not supported on this browser')
        }
    }
    initMidi = (e) => {
        if (!this.mounted) return
        e.onstatechange = this.midiStateChange
        this.MidiAccess = e
        const midiInputs = this.MidiAccess.inputs.values()
        const inputs = []
        for (let input = midiInputs.next(); input && !input.done; input = midiInputs.next()) {
            inputs.push(input.value)
        }
        this.setState({ sources: inputs })
    }
    midiStateChange = (e) => {
        if (!this.mounted) return
        const { sources } = this.state
        const midiInputs = this.MidiAccess.inputs.values()
        const inputs = []
        for (let input = midiInputs.next(); input && !input.done; input = midiInputs.next()) {
            inputs.push(input.value)
        }
        this.setState({ sources: inputs })

        if (sources.length > inputs.length)
            LoggerStore.warn('Device disconnected')
        else if (inputs.length > 0)
            LoggerStore.warn('Device connected')
    }
    selectMidi = (e) => {
        if (!this.mounted) return
        const { sources, selectedSource, settings } = this.state
        const nextSource = sources.find(s => s.id === e.target.value)
        if (selectedSource) selectedSource.onmidimessage = null
        if (!nextSource) return
        nextSource.onmidimessage = this.handleMidi
        settings.currentSource = nextSource.name + " " + nextSource.manufacturer
        this.setState({ selectedSource: nextSource, settings })
        this.saveLayout()
    }
    deselectNotes = () => {
        const { settings } = this.state
        settings.notes.forEach(note => {
            note.status = note.midi < 0 ? 'wrong' : 'right'
        })
        this.setState({ settings })
    }
    saveLayout = () => {
        const { settings } = this.state
        settings.enabled = true
        this.setState({ settings })
        localStorage.setItem(appName + '_MIDI_Settings', JSON.stringify(this.state.settings))
    }
    loadInstrument = async (name) => {
        this.state.instrument?.delete?.()
        const newInstrument = new Instrument(name)
        await newInstrument.load()
        if (!this.mounted) return
        newInstrument.connect(this.audioContext.destination)
        this.setState({
            instrument: newInstrument
        })
    }
    checkIfUsed = (midi, type) => {
        const { shortcuts, notes } = this.state.settings
        if (shortcuts.find(e => e.midi === midi) && ['all','shortcuts'].includes(type) ) return true
        if(notes.find(e => e.midi === midi) && ['all','notes'].includes(type) ) return true
        return false
    }
    handleMidi = (event) => {
        const { selectedNote, settings, selectedShortcut } = this.state
        const [eventType, note, velocity] = event.data

        if (MIDI_STATUS.down === eventType && velocity !== 0) {
            if (selectedNote) {
                if(this.checkIfUsed(note,'shortcuts')) return LoggerStore.warn('Key already used')
                selectedNote.midi = note
                this.deselectNotes()
                this.setState({ selectedNote: null })
                this.saveLayout()
            }
            
            if (selectedShortcut) {
                const shortcut = settings.shortcuts.find(e => e.type === selectedShortcut)
                if(this.checkIfUsed(note,'all')) return LoggerStore.warn('Key already used')
                if (shortcut) {
                    shortcut.midi = note
                    shortcut.status = note < 0 ? 'wrong' : 'right'
                    this.setState({ settings: settings })
                    this.saveLayout()
                }
            }
            const shortcut = settings.shortcuts.find(e => e.midi === note)
            if(shortcut){
                shortcut.status = 'clicked'
                setTimeout(() => {
                    shortcut.status = note < 0 ? 'wrong' : 'right'
                    this.setState({ settings: settings })
                },150)
                this.setState({ settings: settings })

            }
            const keyboardNotes = settings.notes.filter(e => e.midi === note)
            keyboardNotes.forEach(keyboardNote => {
                this.handleClick(keyboardNote, true)
            })
        }
    }
    handleClick = (note, animate = false) => {
        const { settings } = this.state
        if (!animate) this.deselectNotes()
        note.status = 'clicked'
        if (animate) {
            setTimeout(() => {
                note.status = note.midi < 0 ? 'wrong' : 'right'
                this.setState({ settings })
            }, 200)
            this.setState({ settings, selectedShortcut: null })
        } else {
            this.setState({ settings, selectedNote: note, selectedShortcut: null })
        }
        this.playSound(note)
    }
    handleShortcutClick = (shortcut) => {
        this.deselectNotes()
        if (this.state.selectedShortcut === shortcut) {
            return this.setState({ selectedShortcut: null, selectedNote: null })
        }
        this.setState({ selectedShortcut: shortcut, selectedNote: null })
    }
    playSound = (note) => {
        if (note === undefined) return
        this.state.instrument.play(note.index, 1)
    }

    render() {
        const { settings, sources, selectedShortcut } = this.state
        return <div className="default-page">
            <SimpleMenu/>
            <div className="default-content" style={{ alignItems: 'center' }}>
                <div className="column midi-setup-column">
                    <div>
                        Select MIDI device:
                        <select
                            className="midi-select"
                            defaultValue={'None'}
                            onChange={this.selectMidi}
                        >
                            <option disabled value={'None'}> None</option>
                            {sources.map((e, i) => <option value={e.id} key={i}>
                                {e.name}
                            </option>)
                            }
                        </select>
                    </div>
                    <div style={{ margin: '0.5rem 0' }}>
                        Click on the note to map, then press your MIDI keyboard
                    </div>
                </div>
                <div className="midi-setup-content">
                    <div
                        className={appName === 'Genshin' ? "keyboard" : "keyboard keyboard-5"}
                        style={{ marginTop: 'auto', width: 'fit-content' }}
                    >
                        {settings.notes.map((note, i) => {
                            const noteImage = LAYOUT_IMAGES[settings.notes.length][note.index]
                            return <BaseNote
                                key={i}
                                handleClick={this.handleClick}
                                data={note}
                                noteImage={noteImage}
                                noteText={note.midi < 0 ? 'NA' : note.midi}
                            />
                        })}
                    </div>
                    <div className="midi-shortcuts-wrapper">
                        <div style={{ fontSize: '1.5rem' }}>
                            Shortcuts
                        </div>
                        <div className="midi-shortcuts">
                            {settings.shortcuts.map(shortcut =>
                                <Shortcut
                                    key={shortcut.type}
                                    type={shortcut.type}
                                    status={shortcut.status}
                                    midi={shortcut.midi}
                                    selected={selectedShortcut === shortcut.type}
                                    onClick={this.handleShortcutClick}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    }
}