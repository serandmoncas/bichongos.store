import Image from "next/image";

/** Pestaña 1 — El sistema: el problema, las fases, los datos y el estado real. */
export function PanelSistema() {
  return (
    <>
      <section className="wrap">
        <div className="split">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">El problema</p>
              <h2>Cada fase pide un clima distinto</h2>
            </div>
            <p>
              Un hongo no crece en unas condiciones: crece en tres. Primero el
              micelio coloniza el sustrato a oscuras y en calor. Después
              necesita frío y un golpe de luz para que aparezcan los primordios.
              Y al final, aire fresco constante para que las setas engorden en
              vez de estirarse buscando oxígeno.
            </p>
            <p>
              Cada fase dura días o semanas, y equivocarse en una no da una
              cosecha peor: <strong>da ninguna</strong>. Por eso cultivar hongos
              en casa depende hoy de experiencia acumulada — justo lo que un
              principiante no tiene.
            </p>
          </div>
          <figure>
            <Image
              src="/growbox/concepto-capsula-sobremesa.jpg"
              alt="Concepto de cápsula de sobremesa con cúpula transparente, hongos ostra, iluminación LED y nebulización"
              width={1400}
              height={763}
              sizes="(min-width: 880px) 45vw, 100vw"
            />
            <figcaption>
              Ilustración de concepto. El sistema actual es electrónica de
              laboratorio, no un aparato terminado.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="sec-head measure">
          <p className="eyebrow">Cómo funciona</p>
          <h2>Un perfil por especie</h2>
          <p className="lede" style={{ fontSize: "1.05rem" }}>
            Se elige la especie y la cápsula sabe qué hacer en cada momento.
            Estas son las tres fases de la orellana.
          </p>
        </div>
        <div className="phases">
          <div className="phase">
            <span className="n">FASE 01</span>
            <h3>Colonización</h3>
            <p>
              El micelio se extiende por el sustrato. A oscuras, en calor, sin
              prisa.
            </p>
            <dl>
              <div>
                <dt>Temp</dt>
                <dd>24 °C</dd>
              </div>
              <div>
                <dt>Humedad</dt>
                <dd>85 %</dd>
              </div>
              <div>
                <dt>Luz</dt>
                <dd>0 h</dd>
              </div>
            </dl>
          </div>
          <div className="phase">
            <span className="n">FASE 02</span>
            <h3>Inducción</h3>
            <p>
              Baja la temperatura y llega la luz. Es la señal de que hay que
              fructificar.
            </p>
            <dl>
              <div>
                <dt>Temp</dt>
                <dd>20 °C</dd>
              </div>
              <div>
                <dt>Humedad</dt>
                <dd>93 %</dd>
              </div>
              <div>
                <dt>Luz</dt>
                <dd>12 h</dd>
              </div>
            </dl>
          </div>
          <div className="phase">
            <span className="n">FASE 03</span>
            <h3>Fructificación</h3>
            <p>
              Las setas crecen. Aire fresco constante o se estiran buscando
              oxígeno.
            </p>
            <dl>
              <div>
                <dt>Temp</dt>
                <dd>22 °C</dd>
              </div>
              <div>
                <dt>Humedad</dt>
                <dd>88 %</dd>
              </div>
              <div>
                <dt>Luz</dt>
                <dd>12 h</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="instrument">
        <div className="wrap">
          <div className="sec-head measure">
            <p className="live">
              <span className="dot" />
              Datos reales
            </p>
            <h2>Esto no es una maqueta</h2>
            <p style={{ color: "var(--muted)" }}>
              Una cápsula lleva midiendo desde ayer, cada diez segundos, sin que
              nadie la toque. Estas cifras salieron de su base de datos mientras
              se escribía esta página.
            </p>
          </div>
          <div className="readout">
            <div className="cell">
              <p className="k">Última lectura</p>
              <p className="v">
                18,0<span className="u"> °C</span>
              </p>
            </div>
            <div className="cell">
              <p className="k">Humedad</p>
              <p className="v">
                75,6<span className="u"> %</span>
              </p>
            </div>
            <div className="cell">
              <p className="k">Lecturas</p>
              <p className="v">870</p>
            </div>
            <div className="cell">
              <p className="k">Sin interrupción</p>
              <p className="v">
                9,6<span className="u"> h</span>
              </p>
            </div>
          </div>
          <p
            style={{
              marginTop: 22,
              color: "var(--muted)",
              fontSize: ".95rem",
              maxWidth: "62ch",
            }}
          >
            El rango de esas 870 lecturas fue de{" "}
            <strong>17,5 a 21,7 °C</strong>. La cápsula publica lo que mide, un
            servidor lo guarda y la aplicación lo dibuja — sin que haya un
            ordenador encendido en medio.
          </p>
        </div>
      </section>

      <section className="wrap">
        <div className="sec-head measure">
          <p className="eyebrow">En qué punto está</p>
          <h2>Lo que ya hace y lo que todavía no</h2>
        </div>
        <div className="state">
          <div className="yes">
            <h3>
              <span className="tick">●</span> Funcionando hoy
            </h3>
            <ul>
              <li>Mide temperatura y humedad, y lo registra sin parar</li>
              <li>Sabe qué fase toca y qué clima pide cada especie</li>
              <li>Avisa cuando un sensor falla, y se calla cuando se arregla</li>
              <li>Se ve desde el móvil, esté donde esté la cápsula</li>
              <li>Varias cápsulas conviven sin estorbarse ni confundirse</li>
            </ul>
          </div>
          <div className="no">
            <h3>
              <span className="tick">○</span> El paso inmediato
            </h3>
            <ul>
              <li>
                Conectar lo que <em>corrige</em> el clima: calor, frío, niebla y
                riego
              </li>
              <li>
                Hoy el sistema sabe que hace falta calentar — pero aún no puede
                hacerlo
              </li>
              <li>Notificaciones al móvil cuando algo se sale de rango</li>
              <li>Sostenerlo durante ciclos de cultivo completos, no horas</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 0 }}>
        <div className="split flip">
          <div className="stack measure">
            <div className="sec-head">
              <p className="eyebrow">A dónde va</p>
              <h2>De un banco de pruebas a un mueble</h2>
            </div>
            <p>
              La electrónica ya está resuelta y probada. Lo que viene es meterla
              en algo que quepa en una cocina, un aula o una bodega pequeña — y
              comprobar que aguanta cosechas enteras, no una tarde de
              demostración.
            </p>
            <p>
              Un cultivo dura semanas, y es ahí donde aparece lo que ninguna
              prueba corta enseña: la deriva de un sensor, el condensado, el
              corte de luz, la red que se cae de madrugada.
            </p>
          </div>
          <figure>
            <Image
              src="/growbox/concepto-vitrina-madera.jpg"
              alt="Concepto de vitrina de cultivo en madera y vidrio con hongos ostra de varios colores y electrónica visible"
              width={896}
              height={1200}
              sizes="(min-width: 880px) 45vw, 100vw"
            />
            <figcaption>Ilustración de concepto.</figcaption>
          </figure>
        </div>
      </section>

      <section className="closing wrap">
        <p className="quote">
          Cultivar hongos es un problema de constancia. Y la constancia se
          automatiza.
        </p>
      </section>
    </>
  );
}
