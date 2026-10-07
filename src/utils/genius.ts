/**
 * @description All the data that needs to be fetched from the Genius API
 */

import dotenv from "dotenv";
dotenv.config();

let lastSearchId = -1;
const GENIUS_KEY = process.env.GENIUS_API_KEY;
const GENIUS_URL = "https://api.genius.com";

/**
 *
 * @param {string} prompt the search the user makes to find a song
 * @param {number} count the number of searches you can make
 * @returns {ResponseObject} returns a list of songs if the result is successful
 */
async function SearchSongs(prompt, count = 10) {
  if (count > 10 || count <= 0)
    return {
      success: false,
      data: "Search should be between 1 and 10 due to Genius' search range",
    };

  let songSearch = new Request(`${GENIUS_URL}/search?q=${prompt}`, {
    headers: {
      Authorization: "Bearer " + GENIUS_KEY,
    },
  });

  let result = await fetch(songSearch)
    .then((response) => response.json())
    .then((data) => {
      //console.log(data);

      if (data.meta.status != 200)
        return { success: false, data: data.meta.message };

      let songArray = [];

      for (let i = 0; i < count; i++) {
        let song = data.response.hits[i];

        if (song.type != "song") continue;

        songArray.push({
          id: song.result.id,
          name: song.result.title,
          artist: song.result.artist_names,
          artwork: song.result.header_image_thumbnail_url,
        });
      }

      return {
        success: true,
        data: songArray,
      };
    });

  return result;
}

function findYoutubeVideo(media) {
  //console.log(media);

  for (let source of media) {
    // Return the embedded video to watch on the client
    if (source.provider == "youtube")
      return source.url;
  }

  return "";
}

/**
 *
 * @param {int} id a song id based on Genius API's Database
 * @returns {ResponseObject} an object with a success field, and data related
 * to the search if successful
 */
async function GetSongMetadata(id: number) {
  let songId = id !== undefined ? id : lastSearchId;
  lastSearchId = songId;

  if (songId == -1)
    return {
      success: false,
      data: "Song ID is -1 or not available",
    };

  let songSearch = new Request(`${GENIUS_URL}/songs/${songId}`, {
    headers: {
      Authorization: "Bearer " + GENIUS_KEY,
    },
  });

  let result = await fetch(songSearch)
    .then((response) => response.json())
    .then((data: any) => {
      //console.log(data);

      if (data.meta.status != 200)
        return { success: false, data: data.meta.message };

      return {
        success: true,
        data: {
          name: data.response.song.title,
          artist: data.response.song.artist_names,
          artwork: data.response.song.header_image_url,
          video: findYoutubeVideo(data.response.song.media),
        },
      };
    });

  return result;
}

export {
  SearchSongs,
  GetSongMetadata,
};