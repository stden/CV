const gulp = require('gulp');
const prefixer = require('gulp-autoprefixer');
const sass = require('gulp-sass')(require('sass'));
const rigger = require('gulp-rigger');
const pngquant = require('imagemin-pngquant');
const newer = require('gulp-newer');
const uglify = require('gulp-uglify');
const cssmin = require('gulp-clean-css');
const notify = require('gulp-notify');
const gulpif = require('gulp-if');
const { existsSync } = require('node:fs');
const { pipeline } = require('node:stream/promises');

const buildRoot = process.env.CV_BUILD_DIR || 'assets';
const isCI = Boolean(process.env.CI) || process.argv.includes('--type=ci');
const buildPaths = {
    js: `${buildRoot}/js/`,
    css: `${buildRoot}/css/`,
    images: `${buildRoot}/images/`
};

function buildJavaScript() {
    return gulp.src('src/js/main.js')
        .pipe(rigger())
        .pipe(uglify())
        .pipe(gulp.dest(buildPaths.js))
        .pipe(gulpif(!isCI, notify('JS compiled: <%= file.relative %>!')));
}

function buildStyles() {
    return gulp.src('src/scss/style.scss')
        .pipe(sass())
        .pipe(prefixer())
        .pipe(cssmin())
        .pipe(gulp.dest(buildPaths.css))
        .pipe(gulpif(!isCI, notify('STYLE compiled: <%= file.relative %>!')));
}

async function buildImages() {
    if (!existsSync('src/images')) return;
    const { default: imagemin, gifsicle, mozjpeg, svgo } = await import('gulp-imagemin');
    return pipeline(
        gulp.src('src/images/**/*.*', { allowEmpty: true }),
        newer(buildPaths.images),
        imagemin([
            gifsicle({ interlaced: true }),
            mozjpeg({ progressive: true }),
            pngquant(),
            svgo({ plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }] })
        ]),
        gulp.dest(buildPaths.images)
    );
}

function watchFiles() {
    gulp.watch('src/scss/**/*.scss', buildStyles);
    gulp.watch('src/js/**/*.js', buildJavaScript);
    gulp.watch('src/images/**/*.*', buildImages);
}

const build = gulp.parallel(buildJavaScript, buildStyles, buildImages);
exports['js:build'] = buildJavaScript;
exports['style:build'] = buildStyles;
exports['image:build'] = buildImages;
exports.build = build;
exports.watch = watchFiles;
exports.default = gulp.series(build, watchFiles);
