// The screens were written for React loaded as browser globals (UMD) with each file exporting its
// components on window. Keep that contract so the UI code stays unchanged.
import React from 'react';
import * as ReactDOMBase from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';

window.React = React;
window.ReactDOM = { ...ReactDOMBase, createRoot, hydrateRoot };
