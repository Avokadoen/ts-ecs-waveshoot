const path = require('path');
const managerEndpointsTransformer = require('naive-ts-ecs/dist/manager-endpoints.transformer').default;

module.exports = ['ts-loader'].map(loader => ({
    entry: './src/index.ts',
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader,
                exclude: /node_modules/,
                options: {
                    // make sure not to set `transpileOnly: true` here, otherwise it will not work
                    getCustomTransformers: program => ({
                        before: [
                            managerEndpointsTransformer(program)
                        ]
                    })
                }
            },
        ],
    },
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: 9000
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ],
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
}));