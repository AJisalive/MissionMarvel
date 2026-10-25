import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'final-cut-watchlist';
const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

const marvelFilms = [
  ['Iron Man', '2008', 'Iron_Man_(2008_film)'],
  ['The Incredible Hulk', '2008', 'The_Incredible_Hulk_(film)'],
  ['Iron Man 2', '2010', 'Iron_Man_2'],
  ['Thor', '2011', 'Thor_(film)'],
  ['Captain America: The First Avenger', '2011', 'Captain_America:_The_First_Avenger'],
  ['The Avengers', '2012', 'The_Avengers_(2012_film)'],
  ['Iron Man 3', '2013', 'Iron_Man_3'],
  ['Thor: The Dark World', '2013', 'Thor:_The_Dark_World'],
  ['Captain America: The Winter Soldier', '2014', 'Captain_America:_The_Winter_Soldier'],
  ['Guardians of the Galaxy', '2014', 'Guardians_of_the_Galaxy_(film)'],
  ['Avengers: Age of Ultron', '2015', 'Avengers:_Age_of_Ultron'],
  ['Ant-Man', '2015', 'Ant-Man_(film)'],
  ['Captain America: Civil War', '2016', 'Captain_America:_Civil_War'],
  ['Doctor Strange', '2016', 'Doctor_Strange_(2016_film)'],
  ['Guardians of the Galaxy Vol. 2', '2017', 'Guardians_of_the_Galaxy_Vol._2'],
  ['Spider-Man: Homecoming', '2017', 'Spider-Man:_Homecoming'],
  ['Thor: Ragnarok', '2017', 'Thor:_Ragnarok'],
  ['Black Panther', '2018', 'Black_Panther_(film)'],
  ['Avengers: Infinity War', '2018', 'Avengers:_Infinity_War'],
  ['Ant-Man and the Wasp', '2018', 'Ant-Man_and_the_Wasp'],
  ['Captain Marvel', '2019', 'Captain_Marvel_(film)'],
  ['Avengers: Endgame', '2019', 'Avengers:_Endgame'],
  ['Spider-Man: Far From Home', '2019', 'Spider-Man:_Far_From_Home'],
  ['Black Widow', '2021', 'Black_Widow_(2021_film)'],
  ['Shang-Chi and the Legend of the Ten Rings', '2021', 'Shang-Chi_and_the_Legend_of_the_Ten_Rings'],
  ['Eternals', '2021', 'Eternals_(film)'],
  ['Spider-Man: No Way Home', '2021', 'Spider-Man:_No_Way_Home'],
  ['Doctor Strange in the Multiverse of Madness', '2022', 'Doctor_Strange_in_the_Multiverse_of_Madness'],
  ['Thor: Love and Thunder', '2022', 'Thor:_Love_and_Thunder'],
  ['Black Panther: Wakanda Forever', '2022', 'Black_Panther:_Wakanda_Forever'],
  ['Ant-Man and the Wasp: Quantumania', '2023', 'Ant-Man_and_the_Wasp:_Quantumania'],
  ['Guardians of the Galaxy Vol. 3', '2023', 'Guardians_of_the_Galaxy_Vol._3'],
  ['The Marvels', '2023', 'The_Marvels'],
  ['Deadpool & Wolverine', '2024', 'Deadpool_%26_Wolverine'],
].map(([title, year, wikipediaTitle]) => ({ title, year, wikipediaTitle }));

const initialMovies = [];

function loadMovies() {
  try {
    const savedMovies = window.localStorage.getItem(STORAGE_KEY);
    const parsedMovies = savedMovies ? JSON.parse(savedMovies) : initialMovies;
    return Array.isArray(parsedMovies) ? parsedMovies : initialMovies;
  } catch {
    return initialMovies;
  }
}

function App() {
  const [movies, setMovies] = useState(loadMovies);
  const [filter, setFilter] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchState, setSearchState] = useState('idle');
  const [noteMovieId, setNoteMovieId] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
  }, [movies]);

  useEffect(() => {
    if (!isAdding || isManualEntry) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState('loading');

      try {
        let films = marvelFilms;
        if (searchQuery.trim()) {
          const searchParams = new URLSearchParams({
            action: 'query',
            format: 'json',
            list: 'search',
            srnamespace: '0',
            srlimit: '12',
            srsearch: `${searchQuery.trim()} film`,
            origin: '*',
          });
          const searchResponse = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`, { signal: controller.signal });
          if (!searchResponse.ok) throw new Error('Wikipedia search failed');
          const searchData = await searchResponse.json();
          films = searchData.query?.search?.map((result) => ({
            title: result.title.replace(/ \([^)]*film\)$/i, ''),
            year: '',
            wikipediaTitle: result.title.replaceAll(' ', '_'),
          })) ?? [];
        }

        const filmsWithPosters = await Promise.all(films.map(async (film) => {
          const response = await fetch(`${WIKIPEDIA_API}${encodeURIComponent(film.wikipediaTitle)}`, { signal: controller.signal });
          if (!response.ok) return film;
          const summary = await response.json();
          const yearMatch = summary.extract?.match(/\b(19|20)\d{2}\b/);
          return { ...film, title: summary.title.replace(/ \([^)]*film\)$/i, ''), year: film.year || yearMatch?.[0] || '', posterUrl: summary.originalimage?.source || summary.thumbnail?.source };
        }));
        setSearchResults(filmsWithPosters);
        setSearchState('ready');
      } catch (error) {
        if (error.name !== 'AbortError') setSearchState('error');
      }
    }, searchQuery.trim() ? 250 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isAdding, isManualEntry, searchQuery]);

  const watchedCount = movies.filter((movie) => movie.watched).length;
  const ratedMovies = movies.filter((movie) => movie.rating);
  const averageRating = ratedMovies.length
    ? (ratedMovies.reduce((total, movie) => total + movie.rating, 0) / ratedMovies.length).toFixed(1)
    : '--';
  const visibleMovies = movies.filter((movie) => filter === 'all' || (filter === 'watched' ? movie.watched : !movie.watched));

  function addMovie(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setMovies((currentMovies) => [
      ...currentMovies,
      {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        year: year.trim(),
        watched: false,
        rating: null,
        notes: '',
      },
    ]);
    setTitle('');
    setYear('');
    setIsAdding(false);
  }

  function openMovieBrowser() {
    setIsManualEntry(false);
    setSearchQuery('');
    setIsAdding(true);
  }

  function toggleCatalogueMovie(movie) {
    setMovies((currentMovies) => {
      if (currentMovies.some((currentMovie) => currentMovie.wikipediaTitle === movie.wikipediaTitle)) {
        return currentMovies.filter((currentMovie) => currentMovie.wikipediaTitle !== movie.wikipediaTitle);
      }

      return [...currentMovies, {
        id: crypto.randomUUID(),
        wikipediaTitle: movie.wikipediaTitle,
        title: movie.title,
        year: movie.year,
        posterUrl: movie.posterUrl,
        watched: false,
        rating: null,
        notes: '',
      }];
    });
  }

  function toggleWatched(id) {
    setMovies((currentMovies) => currentMovies.map((movie) => (
      movie.id === id ? { ...movie, watched: !movie.watched } : movie
    )));
  }

  function setRating(id, rating) {
    setMovies((currentMovies) => currentMovies.map((movie) => (
      movie.id === id ? { ...movie, watched: true, rating } : movie
    )));
  }

  function setNotes(id, notes) {
    setMovies((currentMovies) => currentMovies.map((movie) => (
      movie.id === id ? { ...movie, notes } : movie
    )));
  }

  function removeMovie(id) {
    setMovies((currentMovies) => currentMovies.filter((movie) => movie.id !== id));
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">YOUR MARVEL RUN</p>
        <div className="title-row">
          <div>
            <h1>MISSION<br /><em>MARVEL</em></h1>
            <p className="tagline">The films you are taking to the end.</p>
          </div>
        </div>
      </section>

      <section className="progress-panel" aria-label="Watchlist progress">
        <div className="progress-heading">
          <span>THE RUN</span>
          <strong>{watchedCount} / {movies.length}</strong>
        </div>
        <div className="progress-track"><span style={{ width: movies.length ? `${(watchedCount / movies.length) * 100}%` : '0%' }} /></div>
        <p>{movies.length ? `${movies.length - watchedCount} films remain before Doomsday.` : 'Build the essential list. Skip the rest.'}</p>
      </section>

      <section className="stats" aria-label="Watchlist statistics">
        <div><span>WATCHED</span><strong>{watchedCount}</strong></div>
        <div><span>ON DECK</span><strong>{movies.length - watchedCount}</strong></div>
        <div><span>AVG. RATING</span><strong>{averageRating}</strong></div>
      </section>

      <section className="watchlist">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PERSONAL SELECTION</p>
            <h2>Your essential viewing</h2>
          </div>
          <button className="add-button" type="button" onClick={openMovieBrowser} aria-label="Browse films">+</button>
        </div>

        <div className="filters" aria-label="Filter films">
          {[
            ['all', `All ${movies.length}`],
            ['unwatched', `To watch ${movies.length - watchedCount}`],
            ['watched', `Seen ${watchedCount}`],
          ].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>

        {visibleMovies.length ? (
          <div className="movie-list">
            {visibleMovies.map((movie, index) => (
              <article className={`movie-card ${movie.watched ? 'is-watched' : ''}`} key={movie.id}>
                {movie.posterUrl ? <img className="watchlist-poster" src={movie.posterUrl} alt="" /> : null}
                <button className="check-button" type="button" onClick={() => toggleWatched(movie.id)} aria-pressed={movie.watched} aria-label={`Mark ${movie.title} as ${movie.watched ? 'not watched' : 'watched'}`} title={movie.watched ? 'Mark as not watched' : 'Mark as watched'}>
                  {movie.watched ? 'SEEN' : String(index + 1).padStart(2, '0')}
                </button>
                <div className="movie-details">
                  <h3>{movie.title}</h3>
                  <p>{movie.year || 'Year not set'} {movie.watched ? ' / Seen' : ' / On deck'}</p>
                  {movie.watched && (
                    <div className="rating-control" aria-label={`Rating for ${movie.title}`}>
                      <span>RATE IT</span>
                      <div>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                          <button key={rating} type="button" className={movie.rating === rating ? 'selected' : ''} onClick={() => setRating(movie.id, rating)} aria-label={`Rate ${rating} out of 10`}>{rating}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {movie.rating && <div className="score">{movie.rating}<small>/10</small></div>}
                <button className="remove-button" type="button" onClick={() => removeMovie(movie.id)} aria-label={`Remove ${movie.title}`}>x</button>
                <button className="notes-button" type="button" onClick={() => setNoteMovieId((currentId) => currentId === movie.id ? null : movie.id)} aria-expanded={noteMovieId === movie.id}>
                  {movie.notes ? 'NOTES' : 'ADD NOTE'}
                </button>
                {noteMovieId === movie.id && (
                  <label className="notes-control">
                    <span>PERSONAL NOTES</span>
                    <textarea value={movie.notes ?? ''} onChange={(event) => setNotes(movie.id, event.target.value)} placeholder="Why is this on the run? What did you think?" />
                  </label>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>+</span>
            <h3>{movies.length ? 'Nothing in this view.' : 'The list is yours to make.'}</h3>
            <p>{movies.length ? 'Try a different filter.' : 'Add only the Marvel films you need to see before Doomsday.'}</p>
            {!movies.length && <button type="button" onClick={openMovieBrowser}>Browse Marvel films</button>}
          </div>
        )}
      </section>

      {isAdding && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsAdding(false)}>
          <div className="add-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" type="button" onClick={() => setIsAdding(false)} aria-label="Close">x</button>
            <p className="eyebrow">ADD TO THE RUN</p>
            {isManualEntry ? (
              <form onSubmit={addMovie}>
                <h2>What are you watching?</h2>
                <label>FILM TITLE<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Captain America: Civil War" /></label>
                <label>RELEASE YEAR <span>(optional)</span><input inputMode="numeric" maxLength="4" value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, ''))} placeholder="2016" /></label>
                <button className="submit-button" type="submit">Add to my list</button>
                <button className="text-button" type="button" onClick={() => setIsManualEntry(false)}>Back to film browser</button>
              </form>
            ) : (
              <>
                <h2>Choose your films</h2>
                <label className="search-label">SEARCH THE CATALOGUE<input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search a Marvel film" /></label>
                <div className="catalogue" aria-live="polite">
                  {searchState === 'loading' && <p className="catalogue-note">Loading poster gallery...</p>}
                  {searchState === 'error' && <p className="catalogue-note error-note">The poster gallery could not be reached. Check your connection and try again.</p>}
                  {searchState === 'ready' && !searchResults.length && <p className="catalogue-note">No films found. Try a different title.</p>}
                  {searchResults.map((movie) => {
                    const alreadyAdded = movies.some((currentMovie) => currentMovie.wikipediaTitle === movie.wikipediaTitle);
                    return (
                      <button className={`catalogue-movie ${alreadyAdded ? 'is-added' : ''}`} type="button" key={movie.wikipediaTitle} onClick={() => toggleCatalogueMovie(movie)} aria-label={`${alreadyAdded ? 'Remove' : 'Add'} ${movie.title}`}>
                        {movie.posterUrl ? <img src={movie.posterUrl} alt="" /> : <span className="no-poster">NO<br />POSTER</span>}
                        <span><strong>{movie.title}</strong><small>{movie.year || 'Release year unknown'}</small></span>
                        <b>{alreadyAdded ? 'REMOVE' : '+'}</b>
                      </button>
                    );
                  })}
                </div>
                <button className="text-button" type="button" onClick={() => setIsManualEntry(true)}>Add a film manually</button>
                <p className="tmdb-credit">Poster images and film information from Wikipedia.</p>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
