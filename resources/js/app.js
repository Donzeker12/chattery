import StoriesIndex from './Pages/Stories/Index';

const app = createInertiaApp({
    resolve: (name) => {
        const pages = {
            // ...existing pages...
            Stories: StoriesIndex,
        };
        return pages[name];
    },
});