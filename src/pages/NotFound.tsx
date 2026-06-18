import { useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6 text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-2 text-xl font-semibold">Страница не найдена</p>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Проверьте адрес или вернитесь на стартовый экран своей роли.
          <span className="sr-only"> Запрошенный путь: {location.pathname}.</span>
        </p>
        <a
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          На стартовый экран
        </a>
      </div>
    </div>
  );
};

export default NotFound;
