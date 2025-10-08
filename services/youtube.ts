
import axios from 'axios';
import { SearchRes } from "./youtube.interface";
export const searchYoutube = async (query:string): Promise<SearchRes> => {
    const url = 'https://yt-music.checkleaked.cc/youtube-music/search'
    const params = { q: query }
    const { data } = await axios.get(url, { params })
    return data;
}