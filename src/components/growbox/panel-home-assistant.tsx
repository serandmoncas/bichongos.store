import Image from "next/image";

/** Pestaña 4 — Home Assistant: la cápsula como un dispositivo más de la casa. */
export function PanelHomeAssistant() {
  return (
    <>
      <section className="wrap">
        <div className="stack measure">
          <div className="sec-head">
            <p className="eyebrow">Home Assistant</p>
            <h2>La cápsula, dentro de una casa inteligente</h2>
          </div>
          <p>
            Home Assistant es el programa libre más extendido para gobernar una
            casa: luces, persianas, termostatos, enchufes. Corre en la misma
            Raspberry Pi que ya tenía la cápsula al lado.
          </p>
          <p>
            Que la cápsula aparezca ahí no es un adorno. Significa que{" "}
            <strong>deja de ser un aparato aislado</strong> y pasa a ser un
            dispositivo más de la casa, con todo lo que eso arrastra:
            automatizaciones, historial, avisos al móvil, voz.
          </p>
        </div>
        <figure className="shot" style={{ marginTop: 38 }}>
          <Image
            src="/growbox/ha-lista-dispositivos.jpg"
            alt="Lista de dispositivos de Home Assistant mostrando las dos cápsulas GrowBox junto a otros aparatos de la casa"
            width={1546}
            height={784}
            sizes="(min-width: 1140px) 1084px, 100vw"
          />
          <figcaption>
            La lista de dispositivos de la casa. Entre el pronóstico del tiempo y
            el router aparecen <code>growbox-73e10c</code> y{" "}
            <code>growbox-a33954</code>: fabricante GrowBox, modelo ESP32 38-pin.
          </figcaption>
        </figure>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="stack measure">
          <div className="sec-head">
            <p className="eyebrow">Cómo llegaron ahí</p>
            <h2>Nadie configuró nada</h2>
          </div>
          <p>
            No se dio de alta ninguna cápsula, no se escribió ninguna dirección,
            no se rellenó ningún formulario. Al encenderse, cada cápsula había
            estado <strong>anunciándose sola</strong> durante horas: publicando
            quién es, qué mide y qué acepta que le manden.
          </p>
          <p>
            Durante ese tiempo no había nadie escuchando. En cuanto Home
            Assistant apareció, leyó esos anuncios y construyó dos dispositivos
            completos en el acto.
          </p>
          <p>
            <strong>Dos, no uno con el doble de cosas.</strong> Cada cápsula
            deriva su nombre del número de serie único de su propio chip, así que
            dos cápsulas nunca se confunden. Era exactamente lo que había que
            demostrar antes de pensar en vender más de una.
          </p>
        </div>
      </section>

      <section className="instrument">
        <div className="wrap">
          <div className="split">
            <div className="stack measure">
              <div className="sec-head">
                <p className="eyebrow">Doce entidades</p>
                <h2>Todo lo que la cápsula expone</h2>
              </div>
              <p>
                Cada cápsula se presenta con doce piezas: lo que mide, lo que
                informa de sí misma y lo que acepta que le manden. Home Assistant
                las trata igual que trataría a un termostato de marca.
              </p>
              <p>
                El registro de la derecha es real: son los cambios de luz que se
                hicieron desde esta misma pantalla, con su hora.
              </p>
            </div>
            <figure className="shot">
              <Image
                src="/growbox/ha-ficha-capsula.jpg"
                alt="Ficha de la cápsula growbox-73e10c en Home Assistant con información del dispositivo, controles y registro de actividad"
                width={1546}
                height={784}
                sizes="(min-width: 880px) 45vw, 100vw"
              />
              <figcaption>
                La ficha de <code>growbox-73e10c</code>: información, mandos y
                actividad reciente.
              </figcaption>
            </figure>
          </div>
          <div className="ents">
            <div>
              <p className="k">Lo que mide</p>
              <ul>
                <li>Temperatura</li>
                <li>Humedad</li>
                <li>Movimiento</li>
              </ul>
            </div>
            <div>
              <p className="k">Lo que informa de sí</p>
              <ul>
                <li>Perfil activo</li>
                <li>Fase activa</li>
                <li>Esfuerzo de refrigeración</li>
                <li>Conectada o no</li>
              </ul>
            </div>
            <div>
              <p className="k">Lo que acepta</p>
              <ul>
                <li>Bomba</li>
                <li>Humidificador</li>
                <li>Modo de luz</li>
                <li>Brillo</li>
                <li>Cambio de perfil</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="stack measure">
          <div className="sec-head">
            <p className="eyebrow">Qué desbloquea</p>
            <h2>Lo que se puede hacer ahora sin escribir código</h2>
          </div>
          <p>
            Todo lo que sigue son cosas que Home Assistant ya sabe hacer con
            cualquier dispositivo, y que la cápsula hereda gratis por el hecho de
            estar ahí dentro:
          </p>
        </div>
        <div className="phases" style={{ marginTop: 26 }}>
          <div className="phase">
            <span className="n">AVISOS</span>
            <h3>Un mensaje al móvil</h3>
            <p>
              «La humedad lleva dos horas por debajo de lo que pide la
              fructificación.» Sin abrir ninguna app del proyecto.
            </p>
          </div>
          <div className="phase">
            <span className="n">REGLAS</span>
            <h3>Si pasa esto, haz aquello</h3>
            <p>
              Encender la luz al amanecer, apagarla ocho horas después, avisar si
              la cápsula deja de responder.
            </p>
          </div>
          <div className="phase">
            <span className="n">HISTORIAL</span>
            <h3>Guardado sin pedirlo</h3>
            <p>
              Home Assistant archiva por su cuenta cada valor. Un tercer sitio
              donde el histórico queda a salvo.
            </p>
          </div>
        </div>
        <div className="caveat">
          <span className="eyebrow">Lo que se vio al conectarlo</span>
          <p>
            Dos entidades aparecen como «desconocido»: el{" "}
            <strong>movimiento</strong>, porque el sensor de presencia todavía no
            da señal y está en investigación, y <strong>conectada</strong>, que
            aún no se publica en el formato que Home Assistant espera.
          </p>
          <p style={{ marginTop: 12 }}>
            Y una tercera enseñó algo más útil: el esfuerzo de refrigeración
            salía como <code>204&nbsp;%</code>. No era un fallo de Home
            Assistant. La cápsula publica ese valor en la escala interna de la
            electrónica —donde 204 es el 80&nbsp;%— y cada programa que lo lee
            debe convertirlo. El panel de control se lo había saltado la semana
            pasada; Home Assistant se lo saltó igual.{" "}
            <strong>
              Añadir un tercer lector destapó un error que llevaba tiempo a la
              vista de todos.
            </strong>{" "}
            Ya está corregido en los dos.
          </p>
        </div>
      </section>
    </>
  );
}
