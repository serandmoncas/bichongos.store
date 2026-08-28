import Image from "next/image";

/** Pestaña 2 — El panel de control: qué muestra, qué manda y cómo viaja la orden. */
export function PanelControl() {
  return (
    <>
      <section className="wrap">
        <div className="stack measure">
          <div className="sec-head">
            <p className="eyebrow">El panel de control</p>
            <h2>Una pantalla que mira la cápsula por dentro</h2>
          </div>
          <p>
            La cápsula no necesita a nadie para funcionar: mide, decide y
            corrige sola. El panel existe para lo otro — para{" "}
            <strong>ver qué está haciendo y por qué</strong>, y para cambiarle la
            orden cuando hace falta.
          </p>
          <p>
            Se abre en cualquier navegador de la casa. No hay que instalar nada,
            no hay que crear una cuenta y no pasa por internet: el navegador
            habla directamente con la cápsula a través del pequeño servidor que
            hay en el mismo domicilio.
          </p>
        </div>
        <figure className="shot" style={{ marginTop: 38 }}>
          <Image
            src="/growbox/panel-completo.jpg"
            alt="Panel de control completo mostrando tarjetas de temperatura y humedad, gráficas históricas y controles de la cápsula"
            width={1500}
            height={761}
            sizes="(min-width: 1140px) 1084px, 100vw"
          />
          <figcaption>
            El panel entero, con datos reales de la cápsula{" "}
            <code>growbox-73e10c</code>. Arriba lo que está pasando ahora; en
            medio cómo se ha llegado hasta aquí; abajo los mandos.
          </figcaption>
        </figure>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="split">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">Lo que está pasando</p>
              <h2>El estado de un vistazo</h2>
            </div>
            <p>
              Cuatro números y un color. La temperatura y la humedad que hay
              ahora, el perfil de cultivo que la cápsula está siguiendo y la fase
              en la que va.
            </p>
            <p>
              El color no es decoración: dice si el valor está dentro de lo que
              ese hongo pide en esa fase. Verde es «esto va bien». Es la
              diferencia entre leer un dato y entenderlo.
            </p>
          </div>
          <figure className="shot">
            <Image
              src="/growbox/panel-tarjetas-estado.jpg"
              alt="Tarjetas del panel con temperatura, humedad, perfil activo y fase de cultivo"
              width={1500}
              height={143}
              sizes="(min-width: 880px) 45vw, 100vw"
            />
            <figcaption>
              21,6 °C y 73 % de humedad relativa, perfil <code>oyster</code>,
              fase de colonización.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="split flip">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">Lo que ha pasado</p>
              <h2>La historia, no solo el instante</h2>
            </div>
            <p>
              Un número suelto no dice nada. Que ahora haya 73 % de humedad puede
              ser normal o puede ser el final de una caída de seis horas — y son
              dos situaciones muy distintas.
            </p>
            <p>
              Las gráficas guardan la forma de lo ocurrido. Es lo que convierte
              el cultivo en algo que se puede <strong>estudiar</strong> y no solo
              vigilar: por qué salió bien esa cosecha, qué se hizo distinto en la
              anterior.
            </p>
          </div>
          <figure className="shot">
            <Image
              src="/growbox/panel-graficas-historicas.jpg"
              alt="Gráficas históricas de temperatura y humedad a lo largo del tiempo"
              width={1500}
              height={179}
              sizes="(min-width: 880px) 45vw, 100vw"
            />
            <figcaption>
              Series de temperatura y humedad. Cada punto es una lectura que la
              cápsula publicó por su cuenta.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="split">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">Lo que se puede cambiar</p>
              <h2>Mandar sobre la cápsula</h2>
            </div>
            <p>
              Encender la luz o apagarla, elegir un tono, subir el brillo,
              arrancar el humidificador, cambiar de perfil de cultivo. Los mandos
              son deliberadamente pocos.
            </p>
            <p>
              Casi todo lo que importa lo decide la cápsula sola a partir del
              perfil. Estos botones son para las excepciones: mirar dentro sin
              abrir, forzar una humidificación, probar algo.
            </p>
          </div>
          <figure className="shot">
            <Image
              src="/growbox/panel-controles.jpg"
              alt="Controles del panel: modo de luz, brillo, bomba, humidificador y selector de perfil"
              width={1500}
              height={215}
              sizes="(min-width: 880px) 45vw, 100vw"
            />
            <figcaption>
              Los mandos. El brillo va de 0 a 255 porque es el valor que entiende
              la tira de luces.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="instrument">
        <div className="wrap">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">Cómo encaja</p>
              <h2>Qué pasa al pulsar un botón</h2>
            </div>
            <p>
              Nada del sistema es mágico, y esta es la parte que más se pregunta.
              Entre el clic y la luz encendida hay cuatro pasos, y ninguno tarda
              más de un parpadeo.
            </p>
          </div>
          <div className="flow">
            <div>
              <span className="n">01</span>
              <h3>El navegador avisa</h3>
              <p>
                Al pulsar, el panel deja un mensaje en el servidor de mensajería
                de la casa. No llama a la cápsula: deja el recado.
              </p>
            </div>
            <div>
              <span className="n">02</span>
              <h3>El servidor reparte</h3>
              <p>
                Ese servidor —Mosquitto, en la Raspberry Pi— entrega el recado a
                quien esté escuchando. Puede haber una cápsula o veinte.
              </p>
            </div>
            <div>
              <span className="n">03</span>
              <h3>La cápsula obedece</h3>
              <p>
                La placa lo recibe y actúa: enciende la luz, arranca el
                humidificador, carga otro perfil.
              </p>
            </div>
            <div>
              <span className="n">04</span>
              <h3>Y responde</h3>
              <p>
                Publica su nuevo estado. El panel lo recoge y se actualiza solo.
                Nadie recarga la página.
              </p>
            </div>
          </div>
          <figure className="shot" style={{ marginTop: 34 }}>
            <Image
              src="/growbox/panel-tras-cambio-luz.jpg"
              alt="El panel de control tras cambiar el modo de luz, reflejando el nuevo estado"
              width={1500}
              height={1169}
              sizes="(min-width: 1140px) 1084px, 100vw"
            />
            <figcaption>
              El panel después de cambiar el modo de luz: refleja el estado que
              la propia cápsula acaba de publicar, no lo que se pulsó.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="wrap">
        <div className="stack measure">
          <div className="sec-head">
            <p className="eyebrow">Dos caminos</p>
            <h2>El panel y el móvil no compiten</h2>
          </div>
          <p>
            Hay dos formas de ver la misma cápsula, y existen las dos a propósito
            porque responden a preguntas distintas.
          </p>
        </div>
        <div className="state">
          <div>
            <h3>El panel, en casa</h3>
            <ul>
              <li>Va por la red local: si se cae internet, sigue funcionando</li>
              <li>Responde al instante y permite mandar</li>
              <li>Solo se ve estando en la casa</li>
            </ul>
          </div>
          <div>
            <h3>La app, en cualquier parte</h3>
            <ul>
              <li>Lee de la nube, que guarda el histórico completo</li>
              <li>Se consulta desde fuera, de viaje</li>
              <li>Hoy solo mira; mandar es el siguiente paso</li>
            </ul>
          </div>
        </div>
        <div className="stack measure" style={{ marginTop: 38 }}>
          <p>
            El recorrido completo del dato es este: la cápsula publica, el
            servidor de la casa reparte, un pequeño programa recoge esos mensajes
            y los guarda en la base de datos, y la app los pide desde donde esté.
          </p>
          <p>
            El panel se salta la nube entera. Por eso sigue vivo cuando internet
            no lo está. La app hace lo contrario, y tiene pestaña propia aquí al
            lado.
          </p>
        </div>
        <div className="caveat">
          <span className="eyebrow">Lo que todavía no hace</span>
          <p>
            Los botones <strong>ordenan, pero no comprueban</strong>. El panel
            muestra la orden que la cápsula dice haber recibido, no una medida de
            que la luz esté realmente encendida. Los actuadores —bomba,
            humidificador, célula Peltier— aún no se han conectado al montaje
            físico: hasta que se conecten, esa distinción importa y se dice.
          </p>
        </div>
      </section>
    </>
  );
}
