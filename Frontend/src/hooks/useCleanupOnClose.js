import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { clearSearchState } from '../../store/HomeSlice';
import { resetVideoId } from '../../store/videoplayerSlice';
import { clearAll as clearAllChat } from '../../store/ChatBotSlice';

const useCleanupOnClose = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        const handleBeforeUnload = () => {
            dispatch(clearSearchState());
            dispatch(resetVideoId());
            dispatch(clearAllChat());
        };

        const handleUnload = () => {
            dispatch(clearSearchState());
            dispatch(resetVideoId());
            dispatch(clearAllChat());
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('unload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('unload', handleUnload);
        };
    }, [dispatch]);
};

export default useCleanupOnClose;
