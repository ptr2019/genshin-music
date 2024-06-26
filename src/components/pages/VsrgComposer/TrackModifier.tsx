import {AppButton} from "$cmp/shared/Inputs/AppButton";
import {VsrgTrackModifier} from "$lib/Songs/VsrgSong";
import {FaEye, FaEyeSlash, FaVolumeMute, FaVolumeUp} from "react-icons/fa";
import {Theme} from "$stores/ThemeStore/ThemeProvider";
import {Row} from "$cmp/shared/layout/Row";


interface TrackModifierProps {
    data: VsrgTrackModifier
    style?: React.CSSProperties
    theme: Theme
    onChange: (data: VsrgTrackModifier) => void
    onVisibilityChange: (visible: boolean) => void
}

export function TrackModifier({data, onChange, onVisibilityChange, theme, style}: TrackModifierProps) {
    const color = theme.layer('menu_background', 0.2).desaturate(0.5)
    return <>
        <Row align={'center'} justify={'between'} className="track-modifier"
             style={{backgroundColor: color.hex(), ...style}}>
            <span className="text-ellipsis">
                {data.alias}
            </span>
            <Row align={'center'} justify={'end'}>
                <AppButton
                    className="flex-centered vsrg-track-modifier-button"
                    onClick={() => onVisibilityChange(!data.hidden)}
                >
                    {data.hidden
                        ? <FaEyeSlash/>
                        : <FaEye/>
                    }
                </AppButton>
                <AppButton
                    className="flex-centered vsrg-track-modifier-button"
                    style={{marginLeft: '0.3rem'}}
                    onClick={() => onChange(data.set({muted: !data.muted}))}
                >
                    {data.muted
                        ? <FaVolumeMute/>
                        : <FaVolumeUp/>
                    }
                </AppButton>
            </Row>
        </Row>
    </>
}