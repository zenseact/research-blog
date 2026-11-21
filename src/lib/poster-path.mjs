// Where the still image of a video thumbnail is served. The image is made from
// the video by the publication-assets integration.
export const POSTER_SUFFIX = '.poster.jpg';

export const posterPath = (video) => video.replace(/\.[^./]+$/, '') + POSTER_SUFFIX;
