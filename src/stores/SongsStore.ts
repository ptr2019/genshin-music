import { songService } from "$lib/Services/SongService"
import { SerializedSong, Song, SongStorable } from "$lib/Songs/Song"
import { makeObservable, observable } from "mobx"


export class SongsStore{
    @observable.shallow songs: SongStorable[] = []
    constructor(){
        makeObservable(this)
    }
    sync = async () => {
        const songs = await songService.getStorableSongs()
        songs.forEach(song => {
            if(!song.type) song.type = Song.getSongType(song)!
            if(song.folderId === undefined) song.folderId = null
        })
        this.songs.splice(0,this.songs.length,...songs)
    }
    _DANGEROUS_CLEAR_ALL_SONGS = async () => {
        await songService._clearAll()
        this.sync()
    }
    removeSong = async (id: string) => {
        await songService.removeSong(id)
        this.sync()
    }
    addSong = async (song: Song) => {
        const result = await songService.addSong(song.serialize())
        this.sync()
        return result
    }
    renameSong = async (id: string, name: string) => {
        await songService.renameSong(id,name)
        this.sync()
    }
    updateSong = async (song: Song) => {
        await songService.updateSong(song.id!, song.serialize())
        this.sync()
    }
    getSongById = async(id: string | null) => {
        if(id === null) return null
        return await songService.getSongById(id)
    }
    addSongToFolder = async (song: SerializedSong, folderId: string | null) => {
        song.folderId = folderId
        await songService.updateSong(song.id!, song)
        this.sync()
    }
    clearSongsInFolder = async (folderId: string) => {
        const storedSongs = this.songs.filter(song => song.folderId === folderId)
        const songs = await songService.getManySerializedFromStorable(storedSongs)
        for(const song of songs){
            if(song != null){
                song.folderId = null
                await songService.updateSong(song.id!, song)
            }
        }
        this.sync()
    }
}
export const songsStore = new SongsStore()
songsStore.sync()


