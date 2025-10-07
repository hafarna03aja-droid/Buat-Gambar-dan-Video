
import { AspectRatio } from './types';

export const ASPECT_RATIOS: AspectRatio[] = [
    { name: 'Instagram Post', ratio: '1:1', value: 1 / 1 },
    { name: 'Instagram Story', ratio: '9:16', value: 9 / 16 },
    { name: 'Facebook Post', ratio: '1.91:1', value: 1.91 / 1 },
    { name: 'Website Banner', ratio: '16:9', value: 16 / 9 },
];

export const FONT_PAIRINGS = [
    { heading: 'Poppins', body: 'Open Sans' },
    { heading: 'Montserrat', body: 'Lato' },
    { heading: 'Playfair Display', body: 'Roboto' },
    { heading: 'Oswald', body: 'Source Sans Pro' },
];

export const COLORS = {
    primary: '#FFD700',
    backgroundLight: '#F5F5F5',
    backgroundWhite: '#FFFFFF',
    textDark: '#1E1E1E',
};
