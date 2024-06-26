//TODO i hate this component with all my heart, the code needs to be improved, but this is the only way to make
//it half performant, maybe i should get rid of react pixi and do it manually, that might improve garbage collection
//since sprites are always removed and added to the stage everytime it scrolls
import {Component, createRef} from 'react'
import {Container, Graphics, Stage} from '@pixi/react';
import {
    FaChevronLeft,
    FaChevronRight,
    FaMinusCircle,
    FaPlusCircle,
    FaStepBackward,
    FaStepForward
} from 'react-icons/fa';
import isMobile from "is-mobile"
import {ComposerCache} from "$cmp/pages/Composer/ComposerCache"
import {APP_NAME} from "$config"
import {MemoizedIcon} from '$cmp/shared/Utility/Memoized';
import {ThemeProvider} from '$stores/ThemeStore/ThemeProvider';
import {clamp, colorToRGB, nearestEven} from '$lib/utils/Utilities';
import type {NoteColumn} from '$lib/Songs/SongClasses';
import type {ComposerSettingsDataType} from '$lib/BaseSettings';
import {isColumnVisible, RenderColumn} from '$cmp/pages/Composer/RenderColumn';
import {TimelineButton} from './TimelineButton';
import {Timer} from '$types/GeneralTypes';
import {ComposedSong} from '$lib/Songs/ComposedSong';
import {subscribeTheme} from '$lib/Hooks/useTheme';
import {createShortcutListener} from '$stores/KeybindsStore';
import {FederatedPointerEvent} from 'pixi.js';
import {ComposerBreakpointsRenderer} from "$cmp/pages/Composer/ComposerBreakpointsRenderer";
import {WithTranslation} from "react-i18next/index";

type ClickEventType = 'up' | 'down-slider' | 'down-stage'

interface ComposerCanvasProps {
    t: WithTranslation<['composer', 'home', 'logs', 'question', 'common']>['t']
    data: {
        columns: NoteColumn[],
        isPlaying: boolean,
        isRecordingAudio: boolean,
        song: ComposedSong
        selected: number,
        currentLayer: number,
        inPreview?: boolean,
        settings: ComposerSettingsDataType,
        breakpoints: number[],
        selectedColumns: number[],
    }
    functions: {
        selectColumn: (index: number, ignoreAudio?: boolean) => void,
        toggleBreakpoint: () => void
    }

}

interface ComposerCanvasState {
    width: number
    height: number
    numberOfColumnsPerCanvas: number
    column: {
        width: number
        height: number
    }
    stageOptions: {
        backgroundColor: number,
        autoDensity: boolean,
        resolution: number,
    },
    timelineOptions: {}
    timelineHeight: number
    currentBreakpoint: number
    theme: {
        timeline: {
            hex: string
            hexNumber: number
            selected: number
            border: number
        }
        sideButtons: {
            hex: string
            rgb: string
        }
        main: {
            background: number
            backgroundHex: string
            backgroundOpacity: number
        }
    }
    cache: ComposerCache | null
}

export default class ComposerCanvas extends Component<ComposerCanvasProps, ComposerCanvasState> {
    state: ComposerCanvasState
    notesStageRef: any
    breakpointsStageRef: any
    stageSelected: boolean
    sliderSelected: boolean
    hasSlided: boolean
    stagePreviousPositon: number
    stageXMovement: number
    stageMovementAmount: number
    sliderOffset: number
    throttleScroll: number
    onSlider: boolean
    cacheRecalculateDebounce: Timer
    cleanup: (() => void)[] = []

    constructor(props: ComposerCanvasProps) {
        super(props)
        const numberOfColumnsPerCanvas = Number(this.props.data.settings.columnsPerCanvas.value)
        const width = 300
        const height = 150
        this.state = {
            width: Math.floor(width),
            height: Math.floor(height),
            numberOfColumnsPerCanvas,
            stageOptions: {
                backgroundColor: ThemeProvider.get('primary').rgbNumber(),
                autoDensity: true,
                resolution: 1.4
            },
            timelineOptions: {
                backgroundAlpha: 0,
                autoDensity: true,
                resolution: 1.4
            },
            column: {
                width: nearestEven(width / numberOfColumnsPerCanvas),
                height: height
            },
            timelineHeight: 30,
            currentBreakpoint: -1,
            theme: {
                timeline: {
                    hex: ThemeProvider.layer('primary', 0.1).toString(),
                    hexNumber: ThemeProvider.layer('primary', 0.1).rgbNumber(),
                    selected: ThemeProvider.get('composer_accent').negate().rgbNumber(),
                    border: ThemeProvider.get('composer_accent').rgbNumber()
                },
                sideButtons: {
                    hex: ThemeProvider.get('primary').darken(0.08).toString(),
                    rgb: colorToRGB(ThemeProvider.get('primary').darken(0.08)).join(',')
                },
                main: {
                    background: ThemeProvider.get('primary').rgbNumber(),
                    backgroundHex: ThemeProvider.get('primary').toString(),
                    backgroundOpacity: ThemeProvider.get('primary').alpha()
                },
            },
            cache: null,
        }
        this.notesStageRef = createRef()
        this.breakpointsStageRef = createRef()
        this.stageSelected = false
        this.sliderSelected = false
        this.hasSlided = false
        this.stagePreviousPositon = 0
        this.stageMovementAmount = 0
        this.sliderOffset = 0
        this.stageXMovement = 0
        this.throttleScroll = 0
        this.onSlider = false
        //TODO memory leak somewhere in this page
        this.cacheRecalculateDebounce = 0
    }

    componentDidMount() {
        const {numberOfColumnsPerCanvas} = this.state
        const sizes = document.body.getBoundingClientRect()
        let width = nearestEven(sizes.width * 0.85 - 45)
        let height = nearestEven(sizes.height * 0.45)
        if (APP_NAME === "Sky") height = nearestEven(height * 0.95)
        this.setState({
            width: Math.floor(width),
            height: Math.floor(height),
            stageOptions: {
                backgroundColor: ThemeProvider.get('primary').rgbNumber(),
                autoDensity: true,
                resolution: window.devicePixelRatio ?? 1.4
            },
            timelineOptions: {
                backgroundAlpha: 0,
                autoDensity: true,
                resolution: window.devicePixelRatio ?? 1.4
            },
            numberOfColumnsPerCanvas,
            column: {
                width: nearestEven(width / numberOfColumnsPerCanvas),
                height: height
            },
            timelineHeight: isMobile() ? 25 : 30,
        }, () => {
            window.addEventListener("resize", this.recalculateCacheAndSizes)
            this.recalculateCacheAndSizes()
        })

        window.addEventListener("pointerup", this.resetPointerDown)
        window.addEventListener("blur", this.resetPointerDown)
        const shortcutDisposer = createShortcutListener("composer", "composer_canvas", ({shortcut}) => {
            const {name} = shortcut
            if (name === "next_breakpoint") this.handleBreakpoints(1)
            if (name === "previous_breakpoint") this.handleBreakpoints(-1)
        })
        this.notesStageRef?.current?._canvas?.addEventListener("wheel", this.handleWheel)
        const themeDispose = subscribeTheme(this.handleThemeChange)
        this.cleanup.push(themeDispose, shortcutDisposer)
    }

    componentWillUnmount() {
        window.removeEventListener("pointerup", this.resetPointerDown)
        window.removeEventListener("blur", this.resetPointerDown)
        window.removeEventListener("resize", this.recalculateCacheAndSizes)
        if (this.cacheRecalculateDebounce) clearTimeout(this.cacheRecalculateDebounce)
        this.notesStageRef?.current?._canvas?.removeEventListener("wheel", this.handleWheel)
        this.cleanup.forEach(fn => fn())
        this.state.cache?.destroy()
        this.notesStageRef = null
        this.breakpointsStageRef = null
    }

    resetPointerDown = () => {
        this.stageSelected = false
        this.sliderSelected = false
        this.stagePreviousPositon = 0
    }
    handleThemeChange = () => {
        this.setState({
            stageOptions: {
                ...this.state.stageOptions,
                backgroundColor: ThemeProvider.get('primary').rgbNumber()
            },
            theme: {
                timeline: {
                    hex: ThemeProvider.layer('primary', 0.1).hex(),
                    hexNumber: ThemeProvider.layer('primary', 0.1).rgbNumber(),
                    selected: ThemeProvider.get('composer_accent').negate().rgbNumber(),
                    border: ThemeProvider.get('composer_accent').rgbNumber()
                },
                sideButtons: {
                    hex: ThemeProvider.get('primary').darken(0.08).hex(),
                    rgb: colorToRGB(ThemeProvider.get('primary').darken(0.08)).join(",")
                },
                main: {
                    background: ThemeProvider.get('primary').rgbNumber(),
                    backgroundHex: ThemeProvider.get('primary').hexa(),
                    backgroundOpacity: Math.max(ThemeProvider.get('primary').alpha(), 0.8)
                }
            }
        }, () => {
            this.recalculateCacheAndSizes()
            if (this.notesStageRef?.current) {
                this.notesStageRef.current.app.renderer.background.color = this.state.theme.main.background
            }
        })
    }
    recalculateCacheAndSizes = () => {
        if (this.cacheRecalculateDebounce) clearTimeout(this.cacheRecalculateDebounce)
        this.cacheRecalculateDebounce = setTimeout(() => {
            if (!this.notesStageRef?.current || !this.breakpointsStageRef?.current) return
            const sizes = document.body.getBoundingClientRect()
            const {numberOfColumnsPerCanvas} = this.state
            const {inPreview} = this.props.data
            let width = nearestEven(sizes.width * 0.85 - 45)
            let height = nearestEven(sizes.height * 0.45)
            if (APP_NAME === "Sky") height = nearestEven(height * 0.95)
            if (inPreview) {
                width = nearestEven(width * (sizes.width < 900 ? 0.8 : 0.55))
                height = nearestEven(height * (sizes.width < 900 ? 0.8 : 0.6))
            }
            let columnWidth = nearestEven(width / numberOfColumnsPerCanvas)
            const oldCache = this.state.cache
            this.setState({
                width: Math.floor(width),
                height: Math.floor(height),
                column: {
                    width: columnWidth,
                    height
                },
                cache: this.generateCache(columnWidth, height, isMobile() ? 2 : 4, isMobile() ? 25 : 30),
            }, () => {
                //TODO not sure why pixi is reusing textures after it's destroyed
                setTimeout(() => {
                    oldCache?.destroy()
                }, 500)
            })
        }, 50)
    }

    generateCache(columnWidth: number, height: number, margin: number, timelineHeight: number) {
        const colors = {
            l: ThemeProvider.get('primary'), //light
            d: ThemeProvider.get('primary') //dark
        }
        colors.l = colors.l.luminosity() < 0.05 ? colors.l.lighten(0.4) : colors.l.lighten(0.1)
        colors.d = colors.d.luminosity() < 0.05 ? colors.d.lighten(0.15) : colors.d.darken(0.03)
        if (!this.notesStageRef?.current || !this.breakpointsStageRef?.current) return null
        return new ComposerCache({
            width: columnWidth,
            height,
            margin,
            timelineHeight,
            app: this.notesStageRef.current.app,
            breakpointsApp: this.breakpointsStageRef.current.app,
            colors: {
                accent: ThemeProvider.get('composer_accent').rotate(20).darken(0.5),
                mainLayer: ThemeProvider.get('composer_main_layer'),
                secondLayer: ThemeProvider.get('composer_secondary_layer'),
                bars: [
                    {
                        color: colors.l.rgbNumber() //lighter
                    }, {
                        color: colors.d.rgbNumber() //darker
                    }, {
                        color: ThemeProvider.get('composer_accent').rgbNumber() //current
                    }, {
                        color: ThemeProvider.get('composer_accent').negate().rgbNumber()
                    }
                ]
            }
        })
    }

    handleWheel = (e: WheelEvent) => {
        this.props.functions.selectColumn(this.props.data.selected + Math.sign(e.deltaY), true)
    }
    handleClick = (e: FederatedPointerEvent, type: ClickEventType) => {
        const x = e.globalX
        const {width, numberOfColumnsPerCanvas} = this.state
        const {data} = this.props
        this.stageXMovement = 0
        this.stageMovementAmount = 0
        if (type === "up") {
            this.sliderSelected = false
        }
        if (type === "down-slider") {
            this.sliderSelected = true
            const relativeColumnWidth = width / data.columns.length
            const stageSize = relativeColumnWidth * (numberOfColumnsPerCanvas + 1)
            const stagePosition = relativeColumnWidth * data.selected - (numberOfColumnsPerCanvas / 2) * relativeColumnWidth
            this.onSlider = x > stagePosition && x < stagePosition + stageSize
            this.sliderOffset = stagePosition + stageSize / 2 - x
            this.throttleScroll = Number.MAX_SAFE_INTEGER
            this.handleSliderSlide(e)
        }
        if (type === "down-stage") {
            this.stagePreviousPositon = x
            this.stageSelected = true
        }
    }
    handleClickStage = (e: FederatedPointerEvent) => {
        this.handleClick(e, "down-stage")
    }
    handleClickStageUp = (e: FederatedPointerEvent) => {
        this.stageSelected = false
        if (this.stageMovementAmount === 0) {
            const middle = (this.state.numberOfColumnsPerCanvas / 2) * this.state.column.width
            const clickedOffset = Math.floor((e.globalX - middle) / this.state.column.width + 1)
            if (clickedOffset === 0) return
            const {data, functions} = this.props
            const newPosition = data.selected + Math.round(clickedOffset)
            functions.selectColumn(clamp(newPosition, 0, data.columns.length - 1))
        }
    }

    handleClickDown = (e: FederatedPointerEvent) => {
        this.handleClick(e, "down-slider")
    }
    handleClickUp = (e: FederatedPointerEvent) => {
        this.handleClick(e, "up")
    }
    handleStageSlide = (e: FederatedPointerEvent) => {
        const x = e.globalX
        const amount = (this.stagePreviousPositon - x)
        this.stagePreviousPositon = x
        if (this.stageSelected) {
            const threshold = this.state.column.width
            const {data, functions} = this.props
            this.stageXMovement += amount
            const amountToMove = (this.stageXMovement - this.stageMovementAmount * threshold) / threshold
            if (Math.abs(amountToMove) < 1) return
            this.stageMovementAmount += Math.round(amountToMove)
            const newPosition = data.selected + Math.round(amountToMove)
            functions.selectColumn(clamp(newPosition, 0, data.columns.length - 1), true)
        }
    }
    handleBreakpoints = (direction: 1 | -1) => {
        const {selected, columns, breakpoints} = this.props.data
        const breakpoint = direction === 1 //1 = right, -1 = left
            ? breakpoints.filter((v) => v > selected).sort((a, b) => a - b)
            : breakpoints.filter((v) => v < selected).sort((a, b) => b - a)
        if (breakpoint.length === 0) return
        if (columns.length >= breakpoint[0] && breakpoint[0] >= 0) {
            this.props.functions.selectColumn(breakpoint[0])
        }
    }
    handleSliderSlide = (e: FederatedPointerEvent) => {
        const globalX = e.globalX
        if (this.sliderSelected) {
            if (this.throttleScroll++ < 4) return
            const {width, column} = this.state
            const {data} = this.props
            this.hasSlided = true
            this.throttleScroll = 0
            const totalWidth = column.width * data.columns.length
            const x = this.onSlider ? (globalX + this.sliderOffset) : globalX
            const relativePosition = Math.floor(x / width * totalWidth / column.width)
            this.props.functions.selectColumn(clamp(relativePosition, 0, data.columns.length - 1), true)
        }
    }
    testStageHitarea = {
        contains: (x: number, y: number) => {
            if (this.stageSelected) return true //if stage is selected, we want to be able to move it even if we are outside the timeline
            const width = this.state.column.width * this.props.data.columns.length
            if (x < 0 || x > width || y < 0 || y > this.state.height) return false
            return true
        }
    }
    testTimelineHitarea = {
        contains: (x: number, y: number) => {
            if (this.sliderSelected) return true //if slider is selected, we want to be able to move it even if we are outside the timeline
            if (x < 0 || x > this.state.width || y < 0 || y > this.state.timelineHeight) return false
            return true
        }
    }

    render() {
        const {width, timelineHeight, height, theme, numberOfColumnsPerCanvas, stageOptions} = this.state
        const {data, functions} = this.props
        const cache = this.state.cache?.cache
        const sizes = this.state.column
        const xPosition = (data.selected - numberOfColumnsPerCanvas / 2 + 1) * -sizes.width
        const beatMarks = Number(data.settings.beatMarks.value)
        const counterLimit = beatMarks === 0 ? 12 : 4 * beatMarks
        const relativeColumnWidth = width / data.columns.length
        const timelineWidth = Math.floor(relativeColumnWidth * (width / sizes.width + 1))
        const timelinePosition = relativeColumnWidth * data.selected - relativeColumnWidth * (numberOfColumnsPerCanvas / 2)
        const isBreakpointSelected = data.breakpoints.includes(data.selected)
        const sideColor = theme.sideButtons.rgb
        const {t} = this.props
        return <div
            className={"canvas-wrapper " + (data.inPreview ? "canvas-wrapper-in-preview" : "")}
            style={{
                width,
                backgroundColor: cache ? "unset" : theme.main.backgroundHex
            }}
        >
            <div className='canvas-relative'>
                <Stage
                    width={width}
                    height={height}
                    raf={false}
                    onMount={this.recalculateCacheAndSizes}
                    style={{opacity: theme.main.backgroundOpacity}}
                    renderOnComponentChange={true}
                    options={stageOptions}
                    ref={this.notesStageRef}
                >
                    {(cache && !data.isRecordingAudio) && <Container
                        x={xPosition}
                        eventMode='static'
                        pointerdown={this.handleClickStage}
                        pointerup={this.handleClickStageUp}
                        pointermove={this.handleStageSlide}
                        interactiveChildren={false}
                        hitArea={this.testStageHitarea}
                    >
                        {data.columns.map((column, i) => {
                            if (!isColumnVisible(i, data.selected, numberOfColumnsPerCanvas)) return null
                            const tempoChangersCache = (i + 1) % 4 === 0 ? cache.columnsLarger : cache.columns
                            const standardCache = (i + 1) % 4 === 0 ? cache.standardLarger : cache.standard
                            const background = column.tempoChanger === 0
                                ? standardCache[Number(i % (counterLimit * 2) >= counterLimit)]
                                : tempoChangersCache[column.tempoChanger]
                            return <RenderColumn
                                cache={cache}
                                key={i}
                                notes={column.notes}
                                index={i}
                                sizes={sizes}
                                instruments={data.song.instruments}
                                currentLayer={data.currentLayer}
                                backgroundCache={background}
                                isToolsSelected={data.selectedColumns.includes(i)}
                                isSelected={i === data.selected}
                                isBreakpoint={data.breakpoints.includes(i)}
                            />
                        })}
                    </Container>
                    }
                </Stage>
                {!data.settings.useKeyboardSideButtons.value && <>
                    <button
                        onPointerDown={() => functions.selectColumn(data.selected - 1)}
                        className={`canvas-buttons ${!data.isPlaying ? 'canvas-buttons-visible' : ''}`}
                        style={{
                            left: '0',
                            paddingRight: '0.5rem',
                            justifyContent: "flex-start",
                            background: `linear-gradient(90deg, rgba(${sideColor},0.80) 30%, rgba(${sideColor},0.30) 80%, rgba(${sideColor},0) 100%)`
                        }}
                    >
                        <FaChevronLeft/>
                    </button>
                    <button
                        onPointerDown={() => functions.selectColumn(data.selected + 1)}
                        className={`canvas-buttons ${!data.isPlaying ? 'canvas-buttons-visible' : ''}`}
                        style={{
                            right: '0',
                            paddingLeft: '0.5rem',
                            justifyContent: "flex-end",
                            background: `linear-gradient(270deg, rgba(${sideColor},0.80) 30%, rgba(${sideColor},0.30) 80%, rgba(${sideColor},0) 100%)`
                        }}
                    >
                        <FaChevronRight/>
                    </button>
                </>}
            </div>
            <div className="timeline-wrapper-bg row">

                <div className="timeline-wrapper" style={{height: this.state.timelineHeight}}>
                    <TimelineButton
                        onClick={() => this.handleBreakpoints(-1)}
                        tooltip={t('previous_breakpoint')}
                        style={{
                            backgroundColor: theme.timeline.hex
                        }}
                        ariaLabel={t('previous_breakpoint')}
                    >
                        <MemoizedIcon icon={FaStepBackward} size={16}/>
                    </TimelineButton>
                    <TimelineButton
                        onClick={() => this.handleBreakpoints(1)}
                        tooltip={t('next_breakpoint')}
                        style={{
                            marginLeft: 0,
                            backgroundColor: theme.timeline.hex
                        }}
                        ariaLabel={t('next_breakpoint')}
                    >
                        <MemoizedIcon icon={FaStepForward} size={16}/>
                    </TimelineButton>

                    <div className='timeline-scroll' style={{backgroundColor: theme.timeline.hex}}>
                        <Stage
                            width={width}
                            height={timelineHeight}
                            options={this.state.timelineOptions}
                            raf={false}
                            ref={this.breakpointsStageRef}
                            renderOnComponentChange={true}
                        >
                            {cache && <Container
                                width={width}
                                height={timelineHeight}
                                eventMode='static'
                                pointerdown={this.handleClickDown}
                                pointerup={this.handleClickUp}
                                pointermove={this.handleSliderSlide}
                                interactiveChildren={false}
                                hitArea={this.testTimelineHitarea}
                            >
                                <Graphics //to fill the space
                                    draw={(g) => {
                                        g.clear()
                                        g.beginFill(theme.timeline.hexNumber)
                                        g.drawRect(0, 0, width, timelineHeight)
                                    }}
                                />
                                {data.selectedColumns.length
                                    ? <Graphics
                                        draw={(g) => {
                                            const first = data.selectedColumns[0] || 0
                                            const last = data.selectedColumns[data.selectedColumns.length - 1]
                                            const x = first * relativeColumnWidth
                                            const xEnd = last * relativeColumnWidth
                                            const width = xEnd - x
                                            g.clear()
                                            g.beginFill(theme.timeline.selected, 0.6)
                                            g.drawRect(x, 0, width, timelineHeight)
                                        }}
                                    />
                                    : null
                                }
                                <ComposerBreakpointsRenderer
                                    breakpoints={data.breakpoints}
                                    texture={cache.breakpoints[0]}
                                    width={width}
                                    columns={data.columns.length}
                                />
                            </Container>
                            }
                            <Graphics //current visible columns
                                draw={(g) => {
                                    g.clear()
                                    g.lineStyle(3, theme.timeline.border, 0.8)
                                    g.drawRoundedRect(0, 0, timelineWidth, timelineHeight - 3, 6)
                                }}
                                x={timelinePosition}
                                y={1.5}
                            />
                        </Stage>
                    </div>
                    <TimelineButton
                        onClick={functions.toggleBreakpoint}
                        style={{
                            backgroundColor: theme.timeline.hex
                        }}
                        tooltip={isBreakpointSelected ? t('remove_breakpoint') : t('add_breakpoint')}
                        ariaLabel={isBreakpointSelected ? t('remove_breakpoint') : t('add_breakpoint')}
                    >
                        <MemoizedIcon icon={isBreakpointSelected ? FaMinusCircle : FaPlusCircle} size={16}/>
                    </TimelineButton>
                </div>
            </div>
        </div>
    }
}