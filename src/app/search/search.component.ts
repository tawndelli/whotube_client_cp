import { Component, OnInit, AfterViewInit, NgZone, HostListener} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SafeHtmlPipe } from '../safe-html-pipe.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'

declare var player: any;
declare function playVideo(): void;
declare function getPlayer(videoId:string): void;

class Video {
  title!: string;
  channel_title!: string;
  channel_thumb_url!: string;
  description!: string;
  id!: string;
  iframe!: string;
  thumb_url!: string;
  is_current = false;
}

interface Playlist {
  title: string;
  channel_title: string;
  channel_thumb_url: string;
  id: string;
  thumbnailUrl: string;
  videos: Video[];
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
  standalone: true,
  imports: [SafeHtmlPipe, CommonModule, FormsModule],
})
export class SearchComponent implements OnInit, AfterViewInit {
  playlist: Playlist = {
    title: '',
    channel_title: '',
    channel_thumb_url: '',
    thumbnailUrl: '',
    id: '',
    videos: [],
  };
  service_url = 'http://127.0.0.1:8080';
  auth!: any;
  currentVideo: Video = {
    title: '',
    channel_title: '',
    channel_thumb_url: '',
    description: '',
    id: '',
    iframe: '',
    thumb_url: '',
    is_current: false,
  };
  searchText = '';
  player: any;
  showPlayer: boolean = false;
  searchTerm: string = '';
  token = '';
  showBusyOverlay: boolean = false;
  searchResultHeader: string = 'Popular Videos';

  constructor(private sanitizer: DomSanitizer, private ngZone: NgZone) {}

  async ngOnInit() {
    var items = await this.fetchPlaylist();
    this.playlist = {
      title: 'Playlist 1',
      channel_title: '',
      channel_thumb_url: '',
      id: 'PL1',
      thumbnailUrl: items.data[0].thumb_url,
      videos: items.data,
    };
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    // if(this.currentVideo.id != '')
    //   var element = document.getElementsByClassName('current-video')![0] as HTMLElement; //.scrollIntoView(true);
    // if (this.currentVideo.id != ''){
    //   var element = document.getElementsByClassName(
    //     'current-video'
    //   )![0] as HTMLElement;
    //   var top = this.findElementTop(element);
    //   document.getElementById('search-container')!.scrollTo(0, top);
    // }
  }

  findElementTop(element: HTMLElement) {
    return element.offsetLeft;
  }

  async authenticate() {
    var result = await fetch(this.service_url + '/auth/login', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    }).then((res) => res.clone().json());

    this.token = result.data;

    if (result.success === undefined) {
      // //redirect to auth page
      window.open('', '_self');
      window.location = result;
      return false;
    }
    return result;
  }

  async home() {
    this.searchResultHeader = 'Popular Videos';
    this.playlist.videos = [];
    this.player.stopVideo();
    this.setPlayerVisibility(false);

    var items = await this.fetchPlaylist(false, true);

    this.playlist = {
      title: 'Playlist 1',
      channel_title: '',
      channel_thumb_url: '',
      id: 'PL1',
      thumbnailUrl: items.data[0].thumb_url,
      videos: items.data,
    };
  }

  async login() {
    // if(this.auth === undefined){
    this.auth = await this.authenticate();

    //   if(this.auth.success){
    //     await this.fetchPlaylist();
    //   }
    // }

    var items = await this.fetchPlaylist(true);

    this.searchResultHeader = 'My Videos';

    this.playlist = {
      title: 'Playlist 1',
      channel_title: '',
      channel_thumb_url: '',
      id: 'PL1',
      thumbnailUrl: items[0].thumb_url,
      videos: items,
    };
    await this.cacheLastPlaylist();
    // await this.fetchLastPlaylist();
  }

  onPlayerStateChanged(event: { data: number }) {
    if (event.data == 0) {
      //play next song if available
      var id = this.getNextVideoId(this.player.playerInfo.videoData.video_id);
      if (id > -1) {
        this.ngZone.run(() => {
          this.loadVideo(this.playlist.videos[id]);
          document
            .getElementsByClassName('current-video')![0]
            .scrollIntoView(true);
        });
      }
    }
  }

  ngAfterViewInit(): void {
    const doc = (<any>window).document;
    let playerApiScript = doc.createElement('script');
    playerApiScript.type = 'text/javascript';
    playerApiScript.src = 'http://www.youtube.com/iframe_api';
    doc.body.appendChild(playerApiScript);

    (<any>window).onYouTubeIframeAPIReady = () => {
      this.player = new (<any>window).YT.Player('yt', {
        width: '100%',
        height: '100%',
        videoId: '',
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onStateChange: this.onPlayerStateChanged.bind(this),
        },
      });

      document.getElementById('yt')!.style.borderRadius = '30px';
      this.setPlayerVisibility(false);
    };
  }

  async getPlaylistItems() {
    //   this.auth = await this.authenticate();
    //   if (this.auth.success) await this.fetchPlaylist();

    // if ((this.auth.success = true)) {
    //   await this.fetchPlaylist(true);

    //   await this.cacheLastPlaylist();
    // }

    this.searchResultHeader = 'More Videos';

    var items = await this.fetchPlaylist();
    this.playlist = {
      title: 'Playlist 1',
      channel_title: '',
      channel_thumb_url: items.data[0].channel_thumb_url,
      id: 'PL1',
      thumbnailUrl: items.data[0].thumb_url,
      videos: items.data,
    };
  }

  async cacheLastPlaylist() {
    var url = this.service_url + '/cache_playlist';

    await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.playlist),
    });
  }

  async fetchCachedPlaylist() {
    var url = this.service_url + '/get_cached_playlist';
    var response = await fetch(url);
    var data = await response.json();
    // this.playlist = JSON.parse(data.data);

    document.getElementById('search-container')!.scrollTo(0, 0);

    return JSON.parse(data.data);
  }

  async fetchPlaylist(mine = false, home = false) {
    this.showBusyOverlay = true;

    var items: any;

    if (home) {
      items = await this.getRelatedItems('');

      document.getElementById('search-container')!.scrollTo(0, 0);

      this.showBusyOverlay = false;

      return items;
    }

    if (mine) {
      // items = await this.getMyPlaylist();
      items = await this.fetchCachedPlaylist();
      this.playlist = items;
    } else {
      // Simulate fetching playlists from YouTube API
      if (this.currentVideo.title) {
        items = await this.getRelatedItems(this.currentVideo.title);
      } else {
        items = await this.getRelatedItems(this.searchTerm);
      }
    }

    document.getElementById('search-container')!.scrollTo(0, 0);

    this.showBusyOverlay = false;

    return items;
  }

  async getMyPlaylist() {
    this.showBusyOverlay = true;
    var url = this.service_url + '/user/my_playlist_items?';
    var playlistItems = await fetch(url).then((res) => res.json());
    this.showBusyOverlay = false;
    return playlistItems.data;
  }

  async getRelatedItems(vidTitle: string) {
    try{
      var url =
        this.service_url +
        '/search/related_search?' +
        new URLSearchParams({ vid_title: vidTitle }).toString();

      var response = await fetch(url, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          Authorization: this.token,
        },
      });

      if(response.ok){
        var playlistItems = await response.json();

        document.getElementById('search-container')!.scrollTo(0, 0);

        return playlistItems ?? [];
      }
    }
    catch(error){
      console.log(error);
    }

    return [];
  }

  onSearchKeyPress(event: KeyboardEvent) {
    if (event.code == 'Enter') {
      this.searchVideos();
    }
  }

  async searchVideos() {
    if (this.searchTerm != '') {
      var url =
        this.service_url +
        '/search/?' +
        new URLSearchParams({ keyword: this.searchTerm }).toString();

      var response = await fetch(url, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
      var result = await response.json();
      this.playlist.videos = [];
      // this.setPlayerVisibility(false);
      // this.player.stopVideo();

      result.data.forEach((vid: any) => {
        this.playlist.videos.push(vid.data);
      });

      this.playlist.thumbnailUrl = this.playlist.videos[0].thumb_url;

      // await this.cacheLastPlaylist();
    }
  }

  loadVideo(video: Video) {
    this.getNextVideoId(video.id);

    // this.setPlayerVisibility(true);

    this.player.loadVideoById(video.id);

    this.currentVideo = video;

    video.is_current = true;

    this.playlist.videos.forEach((x) => {
      if (x != video) {
        x.is_current = false;
      }
    });
  }

  getNextVideoId(videoId: string) {
    var idx = this.playlist.videos.findIndex((vid) => vid.id == videoId);
    if (idx > -1 && idx + 1 < this.playlist.videos.length) {
      return idx + 1;
    }

    return -1;
  }

  setPlayerVisibility(viz: boolean) {
    this.showPlayer = viz;

    if (viz) {
      document.getElementById('player-container')!.style.display = 'flex';
      document
        .getElementById('search-container')!
        .classList.remove('full-width-search');

      // var vidContainers = document.getElementsByClassName('video-container');
      // for (var i = 0; i < vidContainers.length; i++) {
      //   var vidContainer = vidContainers[i] as HTMLElement;
      //   vidContainer.style.width = '400px';
      // }
    } else {
      document.getElementById('player-container')!.style.display = 'none';
      document
        .getElementById('search-container')!
        .classList.add('full-width-search');

      // var vidContainers = document.getElementsByClassName('video-container');
      // for(var i=0;i<vidContainers.length;i++){
      //   var vidContainer = vidContainers[i] as HTMLElement;
      //   vidContainer.style.width = '800px';
      // }
    }
  }

  showVideoChecked(event: MouseEvent) {
    var checkbox = event.target as HTMLInputElement;

    this.setPlayerVisibility(checkbox.checked);
  }

  safeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

