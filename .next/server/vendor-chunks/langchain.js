"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/langchain";
exports.ids = ["vendor-chunks/langchain"];
exports.modules = {

/***/ "(rsc)/./node_modules/langchain/dist/text_splitter.js":
/*!******************************************************!*\
  !*** ./node_modules/langchain/dist/text_splitter.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   CharacterTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.CharacterTextSplitter),\n/* harmony export */   LatexTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.LatexTextSplitter),\n/* harmony export */   MarkdownTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.MarkdownTextSplitter),\n/* harmony export */   RecursiveCharacterTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.RecursiveCharacterTextSplitter),\n/* harmony export */   SupportedTextSplitterLanguages: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.SupportedTextSplitterLanguages),\n/* harmony export */   TextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.TextSplitter),\n/* harmony export */   TokenTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.TokenTextSplitter)\n/* harmony export */ });\n/* harmony import */ var _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @langchain/textsplitters */ \"(rsc)/./node_modules/@langchain/textsplitters/index.js\");\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbGFuZ2NoYWluL2Rpc3QvdGV4dF9zcGxpdHRlci5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUF5QyIsInNvdXJjZXMiOlsid2VicGFjazovL211bHRpLXBlcnNvbmEtcmFnLy4vbm9kZV9tb2R1bGVzL2xhbmdjaGFpbi9kaXN0L3RleHRfc3BsaXR0ZXIuanM/YTg0ZiJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgKiBmcm9tIFwiQGxhbmdjaGFpbi90ZXh0c3BsaXR0ZXJzXCI7XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/langchain/dist/text_splitter.js\n");

/***/ }),

/***/ "(rsc)/./node_modules/langchain/dist/util/document.js":
/*!******************************************************!*\
  !*** ./node_modules/langchain/dist/util/document.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   formatDocumentsAsString: () => (/* binding */ formatDocumentsAsString)\n/* harmony export */ });\n/**\n * Given a list of documents, this util formats their contents\n * into a string, separated by newlines.\n *\n * @param documents\n * @returns A string of the documents page content, separated by newlines.\n */\nconst formatDocumentsAsString = (documents) => documents.map((doc) => doc.pageContent).join(\"\\n\\n\");\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbGFuZ2NoYWluL2Rpc3QvdXRpbC9kb2N1bWVudC5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyIsInNvdXJjZXMiOlsid2VicGFjazovL211bHRpLXBlcnNvbmEtcmFnLy4vbm9kZV9tb2R1bGVzL2xhbmdjaGFpbi9kaXN0L3V0aWwvZG9jdW1lbnQuanM/MGNiYyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEdpdmVuIGEgbGlzdCBvZiBkb2N1bWVudHMsIHRoaXMgdXRpbCBmb3JtYXRzIHRoZWlyIGNvbnRlbnRzXG4gKiBpbnRvIGEgc3RyaW5nLCBzZXBhcmF0ZWQgYnkgbmV3bGluZXMuXG4gKlxuICogQHBhcmFtIGRvY3VtZW50c1xuICogQHJldHVybnMgQSBzdHJpbmcgb2YgdGhlIGRvY3VtZW50cyBwYWdlIGNvbnRlbnQsIHNlcGFyYXRlZCBieSBuZXdsaW5lcy5cbiAqL1xuZXhwb3J0IGNvbnN0IGZvcm1hdERvY3VtZW50c0FzU3RyaW5nID0gKGRvY3VtZW50cykgPT4gZG9jdW1lbnRzLm1hcCgoZG9jKSA9PiBkb2MucGFnZUNvbnRlbnQpLmpvaW4oXCJcXG5cXG5cIik7XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/langchain/dist/util/document.js\n");

/***/ }),

/***/ "(rsc)/./node_modules/langchain/text_splitter.js":
/*!*************************************************!*\
  !*** ./node_modules/langchain/text_splitter.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CharacterTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.CharacterTextSplitter),
/* harmony export */   LatexTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.LatexTextSplitter),
/* harmony export */   MarkdownTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.MarkdownTextSplitter),
/* harmony export */   RecursiveCharacterTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.RecursiveCharacterTextSplitter),
/* harmony export */   SupportedTextSplitterLanguages: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.SupportedTextSplitterLanguages),
/* harmony export */   TextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.TextSplitter),
/* harmony export */   TokenTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.TokenTextSplitter)
/* harmony export */ });
/* harmony import */ var _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dist/text_splitter.js */ "(rsc)/./node_modules/langchain/dist/text_splitter.js");


/***/ }),

/***/ "(rsc)/./node_modules/langchain/util/document.js":
/*!*************************************************!*\
  !*** ./node_modules/langchain/util/document.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   formatDocumentsAsString: () => (/* reexport safe */ _dist_util_document_js__WEBPACK_IMPORTED_MODULE_0__.formatDocumentsAsString)
/* harmony export */ });
/* harmony import */ var _dist_util_document_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../dist/util/document.js */ "(rsc)/./node_modules/langchain/dist/util/document.js");


/***/ })

};
;