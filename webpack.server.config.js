const webpack = require("webpack");
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const version = require("./package.json").version;
const buildRevision = process.env.BUILD_REVISION || "dev";
const buildTime = process.env.BUILD_TIME || "unknown";

const isDevelopment = process.env.NODE_ENV !== "production";

module.exports = {
  mode: isDevelopment ? "development" : "production",
  devtool: isDevelopment
    ? "inline-source-map"
    : process.env.SOURCE_MAPS === "true"
      ? "source-map"
      : false,
  target: "node",
  entry: {
    server: "./src/server/entry",
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx"],
    alias: {
      "@styles": path.resolve(__dirname, "src/styles"),
      "@api": path.resolve(__dirname, "src/api-client"),
      "@components": path.resolve(__dirname, "src/components"),
    },
  },
  output: {
    filename: "[name].bundle.js",
    path: path.join(__dirname, "dist"),
    library: "app",
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: "ts-loader",
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    // Keep SSR's dependency extraction separate from the browser stylesheet.
    // The client build owns client.css, which is the only stylesheet served to
    // production pages. This artifact lets the SSR compilation load the same
    // component CSS without overwriting the client build output.
    new MiniCssExtractPlugin({
      filename: "./assets/server.css",
    }),
    new webpack.DefinePlugin({
      "process.env.COMPONENT_VERSION": JSON.stringify(version),
      "process.env.BUILD_REVISION": JSON.stringify(buildRevision),
      "process.env.BUILD_TIME": JSON.stringify(buildTime),
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
    }),
  ],
};
