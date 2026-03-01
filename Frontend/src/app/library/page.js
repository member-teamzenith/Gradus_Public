"use client";

import React from 'react';
import NotebookViewer from '../../Components/Notebooks/NotebookViewer';

const NotebooksPage = () => {
    return (
        <div style={{ height: '100vh', overflow: 'hidden' }}>
            <NotebookViewer />
        </div>
    );
};

export default NotebooksPage;
