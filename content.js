// Этот скрипт будет пытаться скрыть рекламу на YouTube.
console.log("Простой YouTube Блокировщик v2: Скрипт загружен.");

// Функция для перехвата запросов XMLHttpRequest
function interceptXHR() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  // Перехватываем метод open
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    // Пытаемся перехватить URL-ы, связанные с рекламой
    if (typeof url === 'string') {
      this._adblockerURL = url;
      
      // Проверяем, есть ли в URL признаки рекламы
      if (url.includes('adunit') || 
          url.includes('ad_') || 
          url.includes('adformat') || 
          url.includes('pagead') || 
          url.includes('is_ad=1') || 
          url.includes('googleads') || 
          url.includes('doubleclick.net')) {
        
        console.log('Блокирую XHR запрос к рекламе:', url);
        // Заменяем URL на пустышку для рекламных запросов
        return originalOpen.call(this, method, 'about:blank', ...args);
      }
    }
    
    return originalOpen.call(this, method, url, ...args);
  };

  // Перехватываем метод send для возможного анализа и блокировки
  XMLHttpRequest.prototype.send = function(body) {
    try {
      if (this._adblockerURL && body && typeof body === 'string') {
        // Проверка тела запроса на признаки рекламы
        if (body.includes('adunit') || 
            body.includes('ad_type') || this._adblockerURL.includes('pagead')) {
          console.log('Блокирую XHR body запрос с рекламным содержимым');
          // Можно вернуть пустой результат для рекламных запросов
          this.abort();
          return;
        }
      }
    } catch (e) {
      console.error('Ошибка при анализе XHR:', e);
    }
    
    return originalSend.call(this, body);
  };
}

// Функция для блокировки запросов Fetch API
function interceptFetch() {
  const originalFetch = window.fetch;
  
  window.fetch = function(resource, init) {
    if (typeof resource === 'string') {
      // Проверяем URL на признаки рекламы
      if (resource.includes('adunit') || 
          resource.includes('ad_') || 
          resource.includes('adformat') || 
          resource.includes('pagead') || 
          resource.includes('is_ad=1') || 
          resource.includes('googleads') || 
          resource.includes('doubleclick.net')) {
          
        console.log('Блокирую Fetch запрос к рекламе:', resource);
        // Возвращаем пустой ответ вместо запроса к рекламе
        return Promise.resolve(new Response('', { status: 200 }));
      }
    }
    
    return originalFetch.call(this, resource, init);
  };
}

// Функция для перехвата и модификации свойств плеера по технике AdBlock Plus
function patchVideoPlayer() {
  let adPlaying = false;
  let skipAttempts = 0;
  const MAX_SKIP_ATTEMPTS = 10;
  
  // Наблюдаем за состоянием плеера
  function monitorVideoAds() {
    const observer = new MutationObserver((mutations) => {
      // Проверяем видео элементы
      const video = document.querySelector('video');
      if (!video) return;
      
      // Проверяем, показывается ли реклама
      const player = document.querySelector('.html5-video-player');
      const isAdShowing = player && player.classList.contains('ad-showing');
      
      // Если реклама показывается и мы еще не обрабатывали этот показ
      if (isAdShowing && !adPlaying) {
        console.log('Обнаружена реклама, ждем небольшое время перед пропуском');
        adPlaying = true;
        skipAttempts = 0;
        
        // Позволяем рекламе загрузиться небольшое время (как AdBlock Plus)
        setTimeout(() => {
          skipAdProperly();
        }, 500); // Ждем 500мс для загрузки рекламы
      } 
      // Если реклама больше не показывается, сбрасываем флаг
      else if (!isAdShowing && adPlaying) {
        console.log('Реклама закончилась или была пропущена');
        adPlaying = false;
        skipAttempts = 0;
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }
  
  // Функция для правильного пропуска рекламы после её частичной загрузки
  function skipAdProperly() {
    if (!adPlaying || skipAttempts >= MAX_SKIP_ATTEMPTS) return;
    
    skipAttempts++;
    const video = document.querySelector('video');
    const player = document.querySelector('.html5-video-player');
    
    if (!video || !player) {
      // Если элементы не найдены, попробуем еще раз через небольшой интервал
      setTimeout(skipAdProperly, 100);
      return;
    }
    
    // Проверяем, все еще ли показывается реклама
    if (player.classList.contains('ad-showing')) {
      console.log(`Попытка пропуска рекламы #${skipAttempts}`);
      
      // Сначала попробуем нажать кнопку пропуска, если она есть
      const skipButton = document.querySelector('.ytp-ad-skip-button');
      if (skipButton) {
        console.log('Найдена кнопка пропуска рекламы, нажимаем');
        skipButton.click();
        
        // Проверяем через короткое время, была ли реклама пропущена
        setTimeout(() => {
          if (player.classList.contains('ad-showing')) {
            console.log('Реклама все еще показывается, пробуем перемотать');
            video.currentTime = video.duration;
          }
        }, 300);
      } else {
        // Если кнопки нет, перематываем видео к концу
        console.log('Кнопка пропуска не найдена, перематываем рекламу');
        
        // Сначала попробуем перемотать до конца
        if (video.duration && video.duration > 0) {
          video.currentTime = video.duration;
        }
        
        // Также попробуем отключить звук рекламы
        video.muted = true;
        
        // Если реклама все еще показывается через некоторое время, попробуем еще раз
        setTimeout(() => {
          if (player.classList.contains('ad-showing')) {
            skipAdProperly();
          }
        }, 500);
      }
    } else {
      // Реклама уже не показывается, ничего не делаем
      adPlaying = false;
    }
  }
  
  // Также добавляем обработчик события для перематывания видео, когда появляется реклама
  function addVideoEventHandlers() {
    document.addEventListener('timeupdate', function(e) {
      if (e.target.tagName === 'VIDEO') {
        const player = document.querySelector('.html5-video-player');
        if (player && player.classList.contains('ad-showing') && adPlaying) {
          // Перематываем видео к концу, если это реклама
          if (e.target.duration && e.target.duration > 0) {
            e.target.currentTime = e.target.duration;
          }
        }
      }
    }, true);
  }
  
  // Функция для обхода проверок на блокировщики рекламы
  function bypassAdBlockDetection() {
    // Создаем фиктивный объект, чтобы обойти обнаружение блокировщика
    window.adblockDetector = { 
      isEnabled: false, 
      checkAdsBlocked: function() { return false; }
    };
    
    // Имитируем загрузку рекламы
    if (typeof window.google === 'undefined') {
      window.google = {};
    }
    
    if (typeof window.google.ads === 'undefined') {
      window.google.ads = {
        AdSense: {
          getAdsbygoogle: function() { return []; },
          isAdBlockActive: function() { return false; }
        }
      };
    }
  }
  
  // Инициализация всех патчей для плеера
  monitorVideoAds();
  addVideoEventHandlers();
  bypassAdBlockDetection();
  
  console.log('Патч видеоплеера для пропуска рекламы активирован');
}

// Функция для поиска и скрытия рекламных элементов
function hideAds() {
  // Список селекторов, которые могут указывать на рекламу
  const adSelectors = [
    'ytd-ad-slot-renderer',       // Рекламные слоты (часто для видео)
    'ytd-display-ad-renderer',    // Баннерная реклама
    'ytd-promoted-sparkles-web-renderer', // Продвигаемые видео/элементы
    '.video-ads',                 // Контейнер для видеорекламы
    '#masthead-ad',               // Реклама в шапке
    'ytp-ad-module',              // Модуль плеера для рекламы
    '.ytp-ad-overlay-container',  // Оверлей с рекламой на видео
    'ytd-promoted-video-renderer', // Продвигаемые видео
    'ytd-compact-promoted-video-renderer', // Другой формат промо-видео
    '.ytd-banner-promo-renderer', // Промо-баннеры
    '.ytp-ad-text',               // Текст рекламы
    '.ytp-ad-preview-container',  // Превью рекламы
    '.ad-container',              // Общий контейнер для рекламы
    'tp-yt-paper-dialog:has(.ytd-popup-container)', // Диалоги с рекламой
    'ytd-enforcement-message-view-model' // Сообщения об использовании блокировщика
  ];

  adSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(adElement => {
      // Пытаемся скрыть сам элемент или его ближайшего "родителя"
      let elementToHide = adElement;
      
      // Если это слот, попробуем скрыть родительский элемент
      if (selector === 'ytd-ad-slot-renderer' && elementToHide.closest('ytd-rich-item-renderer')) {
         elementToHide = elementToHide.closest('ytd-rich-item-renderer');
      }

      if (elementToHide && elementToHide.style.display !== 'none') {
          console.log('Скрываю рекламный блок:', elementToHide);
          elementToHide.style.display = 'none';
      }
    });
  });
  
  // Дополнительная проверка на оверлеи рекламы
  const adOverlays = document.querySelectorAll('.ytp-ad-overlay-container');
  adOverlays.forEach(overlay => {
    overlay.style.display = 'none';
  });
  
  // Проверка на статус плеера - есть ли реклама
  const player = document.querySelector('.html5-video-player');
  if (player && player.classList.contains('ad-showing')) {
    // Пытаемся пропустить рекламу
    const skipButton = document.querySelector('.ytp-ad-skip-button');
    if (skipButton) {
      console.log('Нажимаю кнопку пропуска рекламы');
      skipButton.click();
    }
    
    // Если кнопки нет, попробуем перемотать видео
    const video = document.querySelector('video');
    if (video) {
      console.log('Перематываю рекламное видео к концу');
      video.currentTime = video.duration;
    }
  }
}

// Наблюдатель за изменениями в DOM
const adObserver = new MutationObserver((mutations) => {
  // При любых изменениях снова пытаемся скрыть рекламу
  hideAds();
});

// Запускаем все функции блокировки
function initAdblocker() {
  try {
    // Перехватываем XHR и Fetch для блокировки запросов к рекламе
    interceptXHR();
    interceptFetch();
    
    // Патчим видеоплеер для пропуска рекламы
    patchVideoPlayer();
    
    // Начать наблюдение за изменениями в body и его потомках
    adObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Первичный запуск при загрузке скрипта
    hideAds();
    
    console.log("Простой YouTube Блокировщик v2: Все методы блокировки активированы");
  } catch (e) {
    console.error("Ошибка при инициализации блокировщика:", e);
  }
}

// Запускаем блокировщик
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdblocker);
} else {
  initAdblocker();
}

// Для страниц, которые загружаются после первоначальной загрузки (например, SPA)
window.addEventListener('yt-navigate-finish', function() {
  console.log("Обнаружена навигация по YouTube, обновляю блокировку");
  hideAds();
});