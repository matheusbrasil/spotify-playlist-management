# 🎧 Smart Spotify Playlist Splitter

An intelligent music management application built with **Node.js**, **Express.js**, and **React Native**, designed to enhance your Spotify experience.

This app connects to the **Spotify Web API** to fetch and display all your playlists and their songs, providing detailed information for each track — including **Song Name**, **Album Name**, **Artist Name**, and **Genre**.  
If any genres are missing, the app leverages the **OpenAI API** to intelligently fill in the gaps.

---

## 🚀 Features

- 🔗 **Spotify Integration:** Connect to your Spotify account to retrieve playlists and songs.  
- 🎵 **Detailed Song Information:** Display each track’s name, artist, album, and genre.  
- 🤖 **Smart Genre Detection:** Automatically fetch missing genres using the OpenAI API.  
- 🧠 **Smart Split Functionality:**  
  - Analyze any playlist and group songs by genre.  
  - Suggest new playlist names based on genres.  
  - Allow users to edit proposed names.  
  - Automatically create new playlists on Spotify with one click.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js  
- **Frontend:** React Native  
- **APIs:** Spotify Web API, OpenAI API  
- **Authentication:** OAuth 2.0 (Spotify login)  
- **Database (optional):** SQLite or PostgreSQL  
- **Environment:** JavaScript / TypeScript

---

## ⚙️ Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/matheusbrasil/spotify-playlist-management.git
cd smart-spotify-playlist-splitter