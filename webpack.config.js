const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { emit } = require("process");
const appDirectory = path.resolve(__dirname);
const { presets, plugins } = require(`${appDirectory}/babel.config.js`);
const compileNodeModules = [
  // Add every react-native package that needs compiling
  'react-native-gesture-handler'
].map((moduleName) => path.resolve(appDirectory, `node_modules/${moduleName}`));

const babelLoaderConfiguration = {
  test: /\.(js|jsx|ts|tsx|mjs)$/, // Updated to include .jsx
  // Add every directory that needs to be compiled by Babel during the build.
  include: [
    path.resolve(__dirname, "index.web.js"), // Entry to your application
    path.resolve(__dirname, "App.tsx"), 
    path.resolve(__dirname, "component"),
    path.resolve(__dirname, "Components"),
    ...compileNodeModules,
  ],
  use: {
    loader: "babel-loader",
    options: {
      cacheDirectory: true,
      presets,
      plugins,
    },
  },
};

const svgLoaderConfiguration = {
  test: /\.svg$/,
  use: [
    {
      loader: "@svgr/webpack",
    },
  ],
};

const imageLoaderConfiguration = {
  test: /\.(gif|jpe?g|png|svg)$/,
  use: {
    loader: "url-loader",
    options: {
      name: "[name].[ext]",
    },
  },
};

const tsLoaderConfiguration = {
  test: /\.tsx?$/,
  exclude: /node_modules|\.d\.ts\.tsx$/, // this line as well
  use: {
    loader: 'ts-loader',
    options: {
        compilerOptions: {
            noEmit: false,
            'jsx': "react-native"
        }
    }
  },
};

const javascriptRules = {
  test: /\.m?js/,
  type: "javascript/auto",
}

const fullySpecifiedRules = {
  test: /\.m?js/,
  resolve: {
    fullySpecified: false,
  }
};

const jsonRules = {
  test: /\.json$/,
  type: 'asset/resource'
}

const cssLoaderConfiguration = {
  test: /\.css$/i,
  use: ['style-loader', 'css-loader'],
};

const iconLoaderConfiguration = {
  test: /\.ttf$/,
  use: {
    loader: 'url-loader',
    },
    include: path.resolve(__dirname, 'node_modules/react-native-vector-icons'),
};

const localAssetsLoaderConfiguration = {
  test: /\.(ttf|eot|woff|woff2)$/,
  use: {
    loader: 'url-loader',
  },
    include: path.resolve(__dirname, 'assets/fonts')
};

const jsIconLoaderConfiguration = {
  test: /\.js$/,
  exclude: /node_modules\/(?!(react-native-elements|react-native-vector-icons)\/).*/,
  loader: 'babel-loader'
};

module.exports = {
  entry: {
    app: path.join(__dirname, "index.web.js"),
  },
  output: {
    filename: "rnw.bundle.js",
  },
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".web.js", ".js", ".mjs"],
    alias: {
      "react-native$": "react-native-web",
    },
  },
  module: {
    rules: [
      babelLoaderConfiguration,
      imageLoaderConfiguration,
      svgLoaderConfiguration,
      tsLoaderConfiguration,
      javascriptRules,
      fullySpecifiedRules,
      jsonRules,
      cssLoaderConfiguration,
      iconLoaderConfiguration,
      localAssetsLoaderConfiguration,
      jsIconLoaderConfiguration
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "index.html"),
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      __DEV__: JSON.stringify(true),
      process: { env: {} } 
    }),
  ],
};