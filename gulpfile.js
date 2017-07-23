/// <binding />
//'use strict';

const gulp = require('gulp');
const ts = require('gulp-typescript');
const gulp_clean = require('gulp-clean');

const  tsProject = ts.createProject('tsconfig.json', { noImplicitAny: false });

gulp.task('default', ['copy_json'], function () {
    process.exit();
});

gulp.task('clean', function () {
    return gulp.src('build', {read: false})
        .pipe(gulp_clean());
});

gulp.task('ts', ['clean'], function () {
    return gulp.src('src/**/*.ts')
        .pipe(tsProject())
        .on('error', function (error) {
            console.log('typescript error ' + error);
            process.exit(1);
        })
        .pipe(gulp.dest('build'));
});

gulp.task('copy_json', ['ts'], function () {
  return gulp.src(['src/**/*.json'])
    .pipe(gulp.dest('build'));
});






