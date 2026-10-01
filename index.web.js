import { AppRegistry } from 'react-native';
import {name} from './app.json';
import App from './App';
import './App.css';
import FontAwesomeFont from 'react-native-vector-icons/Fonts/FontAwesome.ttf';
import IoniconsFont from 'react-native-vector-icons/Fonts/Ionicons.ttf';

window.process = { env: {} };

// const iconFontStyles = `@font-face {
//   src: url(${FontAwesomeFont});
//   font-family: 'FontAwesome';
// }`;

// const ioniconFontStyles = `@font-face {
//   src: url(${IoniconsFont});
//   font-family: 'Ionicons';
// }`;

// console.log(iconFontStyles, ioniconFontStyles);// Append the styles to the document head
// const style = document.createElement('style');
// style.type = 'text/css';
// if (style.styleSheet) {
//   style.styleSheet.cssText = [iconFontStyles, ioniconFontStyles].join('\n');
// } else {
//   style.appendChild(document.createTextNode(iconFontStyles));
//   style.appendChild(document.createTextNode(ioniconFontStyles));
// }
// console.log(style)
// document.head.appendChild(style);

AppRegistry.registerComponent(name, () => App);
AppRegistry.runApplication(name, {
  initialProps: {},
  rootTag: document.getElementById('app-root')
});