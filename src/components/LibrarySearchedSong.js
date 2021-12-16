import { useState } from 'react'
import { FaDownload, FaSpinner } from 'react-icons/fa';
import { LoggerEvent, prepareSongImport } from "lib/Utils"

export default function SearchedSong(props) {
    const { functions, data, songStore } = props
    const { importSong } = functions
    const [fetching, setFetching] = useState(false)
    const [cache, setCache] = useState(undefined)
    const download = async function () {
        if (fetching) return
        try {
            if (cache) return importSong(cache)
            setFetching(true)
            let song = await fetch('https://sky-music.herokuapp.com/api/songs?get=' + encodeURI(data.file)).then(data => data.json())
            setFetching(false)
            song = prepareSongImport(song)
            setCache(song)
            importSong(song)
        } catch (e) {
            setFetching(false)
            console.error(e)
            new LoggerEvent("Error", "Error downloading song").trigger()
        }
    }
    const play = async function () {
        if (fetching) return
        try {
            if (cache) {
                return songStore.data = {
                    eventType: 'play',
                    song: cache,
                    start: 0
                }
            }
            setFetching(true)
            let song = await fetch('https://sky-music.herokuapp.com/api/songs?get=' + encodeURI(data.file)).then(data => data.json())
            setFetching(false)
            song = prepareSongImport(song)
            setCache(song)
            songStore.data = {
                eventType: 'play',
                song: song,
                start: 0
            }
        } catch (e) {
            console.error(e)
            setFetching(false)
            new LoggerEvent("Error", "Error downloading song").trigger()
        }
    }
    return <div className="song-row">
        <div className="song-name" onClick={() => {
            play(data)
        }}>
            {data.name}
        </div>
        <div className="song-buttons-wrapper">
            <button className="song-button" onClick={download}>
                {fetching ? <FaSpinner /> : <FaDownload />}
            </button>
        </div>
    </div>
}