import Image from "next/image";

/** Pestaña 3 — La app móvil: la flota, los estados y las pantallas. */
export function PanelApp() {
  return (
    <>
      <section className="wrap">
        <div className="stack measure">
          <div className="sec-head">
            <p className="eyebrow">La app móvil</p>
            <h2>La cápsula en el bolsillo</h2>
          </div>
          <p>
            El panel de control vive en casa. La app existe para la otra mitad
            del problema: <strong>estar lejos y querer saber</strong>. Se instala
            en el móvil, lee de la nube y funciona desde donde haya cobertura.
          </p>
          <p>
            Y hace una sola cosa: <strong>mirar</strong>. No enciende luces, no
            arranca la bomba, no cambia perfiles. Eso es una decisión, no una
            carencia — mandar sobre un aparato desde fuera de la casa exige un
            camino de seguridad que todavía no está construido, y la cápsula ya
            decide sola casi todo.
          </p>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="split">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">La lista</p>
              <h2>Ordenadas por urgencia, no por nombre</h2>
            </div>
            <p>
              La primera pantalla es la flota entera. Cada tarjeta lleva el
              nombre, la temperatura, la humedad y cuánto hace que se supo algo
              de esa cápsula.
            </p>
            <p>
              El orden no es alfabético:{" "}
              <strong>arriba va lo que más atención pide</strong>. Sin señal
              primero, luego las que tienen alarma, luego las que se están
              desviando, y al final las que van bien. Quien abre la app a las
              tres de la mañana no debería tener que buscar.
            </p>
            <p>
              En esta captura todas dicen «sin señal», y era cierto: el día de la
              toma, la Raspberry Pi de casa llevaba días apagada.{" "}
              <strong>
                La app estaba diciendo la verdad sobre una avería real
              </strong>
              , que es exactamente para lo que sirve. Con la Pi encendida de
              nuevo, las cápsulas físicas vuelven a reportar en segundos.
            </p>
          </div>
          <figure className="phone">
            <Image
              src="/growbox/app-lista-capsulas.jpg"
              alt="Lista de cápsulas en la app, cada una con su temperatura, humedad y estado"
              width={349}
              height={760}
              sizes="300px"
            />
            <figcaption>
              La flota. Siete cápsulas: cinco de demostración, sembradas para
              poder ver todos los estados, y las dos físicas.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="instrument">
        <div className="wrap">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">La regla</p>
              <h2>Qué significa cada estado</h2>
            </div>
            <p>
              Cuatro estados, y cada uno se calcula con una regla escrita, no a
              ojo:
            </p>
          </div>
          <div className="readout">
            <div className="cell">
              <p className="k">Sin señal</p>
              <p className="v" style={{ fontSize: "1rem", color: "var(--muted)" }}>
                nadie sabe nada
              </p>
              <p className="u">
                La cápsula se despidió, o lleva más de tres minutos callada.
              </p>
            </div>
            <div className="cell">
              <p className="k">Alarma</p>
              <p className="v" style={{ fontSize: "1rem", color: "var(--coral)" }}>
                algo está mal
              </p>
              <p className="u">Hay al menos una alarma abierta sin resolver.</p>
            </div>
            <div className="cell">
              <p className="k">Aviso</p>
              <p className="v" style={{ fontSize: "1rem" }}>
                se está desviando
              </p>
              <p className="u">
                Más de 2 °C de diferencia con la consigna de su fase.
              </p>
            </div>
            <div className="cell">
              <p className="k">En orden</p>
              <p className="v" style={{ fontSize: "1rem", color: "var(--mint)" }}>
                todo bien
              </p>
              <p className="u">Ninguna de las anteriores.</p>
            </div>
          </div>
          <div className="stack measure" style={{ marginTop: 32 }}>
            <p>
              <strong>Una sutileza que costó pensar.</strong> El silencio se mide
              sobre cuándo se supo algo de la cápsula, no sobre cuándo tomó su
              última medida buena. Una cápsula con el sensor roto sigue hablando
              —está viva y está gritando— pero su última lectura válida se queda
              congelada. Medir sobre la lectura la daría por muerta justo cuando
              más falta hace escucharla.
            </p>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="split flip">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">Una cápsula</p>
              <h2>El número, y al lado lo que debería ser</h2>
            </div>
            <p>
              Al tocar una tarjeta se abre la cápsula por dentro. Y lo importante
              no es el número grande, sino lo que va justo debajo:{" "}
              <strong>la consigna</strong>.
            </p>
            <p>
              «21,9 °C» no dice nada por sí solo. «21,9 °C, consigna 24 °C» dice
              que va fría y cuánto. Es la diferencia entre un dato y una
              decisión.
            </p>
            <p>
              Debajo, el historial en tres ventanas —24 horas, 7 días, 30 días—
              con el mínimo y el máximo de cada tramo. La forma de la curva es lo
              que enseña; el instante, no.
            </p>
          </div>
          <figure className="phone">
            <Image
              src="/growbox/app-ficha-capsula.png"
              alt="Ficha de una cápsula en la app, con temperatura, humedad, sus consignas y las gráficas históricas"
              width={1206}
              height={2622}
              sizes="300px"
            />
            <figcaption>
              La cápsula <code>growbox-73e10c</code> el 22 de agosto, cuando
              todavía publicaba. Alarma abierta y el historial de las últimas 24
              horas.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="split">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">Qué está haciendo</p>
              <h2>El perfil y los actuadores</h2>
            </div>
            <p>
              Más abajo en la misma pantalla está lo que la cápsula está haciendo
              ahora mismo: qué perfil sigue, en qué fase va y{" "}
              <strong>qué día de esa fase</strong> —porque un cultivo se mide en
              días, no en horas—, y el estado de cada actuador.
            </p>
            <p>
              Aparecen en gris, sin botones. Es la misma decisión de antes, hecha
              visible: aquí se lee, no se manda.
            </p>
          </div>
          <figure className="phone">
            <Image
              src="/growbox/app-perfil-actuadores.jpg"
              alt="Ficha de la cápsula Orellana 2 mostrando perfil activo, fase y el estado de los actuadores en solo lectura"
              width={349}
              height={760}
              sizes="300px"
            />
            <figcaption>
              <code>Orellana 2</code>: perfil Oyster, fructificación, día 9. El
              Peltier al 80 % enfriando y la luz en modo alarma.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="stack measure">
          <div className="sec-head">
            <p className="eyebrow">Las otras dos pantallas</p>
            <h2>El historial de fallos y los nombres</h2>
          </div>
          <p>
            La app tiene otras dos pestañas, y las dos existen por una razón
            concreta.
          </p>
        </div>
        <div className="phones">
          <figure className="phone">
            <Image
              src="/growbox/app-alertas.jpg"
              alt="Pantalla de alertas de la app, con las alarmas agrupadas por cápsula y marcadas como activas o resueltas"
              width={349}
              height={760}
              sizes="340px"
            />
            <figcaption>
              <strong>Alertas.</strong> Agrupadas por cápsula, y cada una dice si
              sigue abierta o ya se resolvió. Las de la captura son reales: dos
              cápsulas con el sensor sin responder y una temperatura fuera de
              rango, entre el 20 y el 22 de agosto.
            </figcaption>
          </figure>
          <figure className="phone">
            <Image
              src="/growbox/app-ajustes.jpg"
              alt="Pantalla de ajustes de la app, con el nombre editable de cada cápsula y el modo de API"
              width={349}
              height={760}
              sizes="340px"
            />
            <figcaption>
              <strong>Ajustes.</strong> Cada cápsula se llama por dentro{" "}
              <code>growbox-73e10c</code>, que es su número de serie. Aquí se le
              pone un nombre que una persona reconozca — «Orellana 2»,
              «Shiitake» — sin tocar la identidad que usa el sistema.
            </figcaption>
          </figure>
        </div>
        <div className="caveat">
          <span className="eyebrow">Dos cosas que conviene saber</span>
          <p>
            <strong>Los avisos no los decide la app.</strong> Cuando una cápsula
            se sale de rango, quien lo detecta y manda la notificación al móvil
            es el servidor, no el teléfono. Es deliberado: así el aviso llega con
            la app cerrada, con el móvil en el bolsillo, o incluso desinstalada.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Cinco de las siete cápsulas no existen.</strong> Son filas de
            demostración sembradas en la base de datos a propósito, cada una
            colocada en un estado distinto para poder comprobar que la regla de
            más arriba funciona en los cuatro casos. Las cápsulas físicas son
            dos: <code>growbox-73e10c</code> y <code>growbox-a33954</code>.
          </p>
        </div>
      </section>
    </>
  );
}
