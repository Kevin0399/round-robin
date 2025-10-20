// ================================
// Variables globales
// ================================
let procesos = []; // Todos los procesos generados
let nuevos = []; // Cola de procesos en estado Nuevo
let listos = []; // Cola de procesos Listos
let bloqueados = []; // Cola de procesos Bloqueados
let terminados = []; // Procesos que ya terminaron
let enMemoria = []; // Procesos en memoria
let procesoEnEjecucion = null; // Proceso que esta en CPU
let relojGlobal = -1; // Tiempo global de simulacion
let intervalo = null; // Intervalo principal de simulacion
let pausado = false; // Pausa de la simulacion
let numProcesos = 0; // Cantidad total de procesos
let idContador = 1; // Contador para asignar IDs unicos
let contTerminados = 0; // Contador de cuantos procesos han terminado
let terminadoError = false;
let bcp = false; // Bandera para mostrar el BCP
let quantum = 0; // Tamaño del quantum
let quantumCumplido = false; // Bandera para indicar cuadno un proceso ha cumplido su quantum
let procesoInterrumpido = null; // Almacena el proceso interrumpido(se completo su quantum)


// ================================
// Fase Inicial -> crear procesos
// ================================
document.getElementById("btnIniciar").addEventListener("click", () => {
    const cantidad = parseInt(document.getElementById("numProcesos").value);
    const tamanioQtm = parseInt(document.getElementById('quantum').value);

    if (isNaN(cantidad) || cantidad <= 0) {
        alert("Por favor ingresa un numero valido de procesos");
        return;
    }

    if (isNaN(tamanioQtm) || tamanioQtm <= 0) {
        alert("Por favor ingresa un numero valido de quantum");
        return;
    }
    numProcesos = cantidad;
    quantum = tamanioQtm;
    generarProcesos(numProcesos);

    // Pasar de Fase Inicial a Fase Ejecucion
    document.getElementById("faseInicial").style.display = "none";
    document.getElementById("faseEjecucion").style.display = "block";
    document.getElementById("pantallaBcp").style.display = "none";
    document.getElementById("faseResultados").style.display = "none";

    // Iniciar el tick cada segundo
    if (!intervalo) intervalo = setInterval(tick, 1000);
});

// ================================
// Generar procesos aleatorios
// ================================
const generarProcesos = (n) => {
    for (let i = 0; i < n; i++) {
        const tiempoMax = Math.floor(Math.random() * 15) + 6; // TME entre 6 y 20
        let a = Math.floor(Math.random() * 10) + 1;
        let b = Math.floor(Math.random() * 10) + 1;
        let ops = ["+", "-", "*", "/", "%"];
        let op = ops[Math.floor(Math.random() * ops.length)];

        // Evitar division entre cero
        if ((op === "/" || op === "%") && b === 0) b = 1;

        // Crear objeto proceso
        const proceso = {
            id: idContador++,
            op: `${a} ${op} ${b}`,
            a,
            b,
            operador: op,
            tiempoMax,
            tiempoTrans: 0,
            estado: "Nuevo",
            llegada: null,
            finalizacion: null,
            retorno: null,
            respuesta: null,
            espera: 0,
            servicio: 0,
            resultado: null,
            error: false,
            bloqueadoRestante: 0,
            quantumTrans: 0
        };
        nuevos.push(proceso);
    }
    render(); // Actualizar pantalla
}

// ================================
// Bucle principal de la simulacion
// ================================
const tick = () => {

    if (pausado) return;

    // Incrementar reloj global del ciclo
    relojGlobal++;
    console.log(relojGlobal);

    // Si se cumplio un quantum, colocamos el proceso interrumpido al final de listos
    if (quantumCumplido) {
        listos[listos.length] = procesoInterrumpido;
        procesoInterrumpido = null;
        quantumCumplido = false;
    }

    // Admitir procesos desde Nuevos a Listos si hay espacio (max 4 en memoria)
    while (listos.length + bloqueados.length + (procesoEnEjecucion ? 1 : 0) < 4 && nuevos.length > 0) {
        let proc = nuevos.shift();
        proc.estado = "Listo";
        proc.llegada = relojGlobal; // Guardamos el tiempoen el que el proceso llego
        listos.push(proc);
        enMemoria.push(proc); // Guardamos los procesos en memoria
    }

    // Si no hay proceso en ejecucion, tomar el siguiente de listos
    if (!procesoEnEjecucion && listos.length > 0) {
        procesoEnEjecucion = listos.shift();
        procesoEnEjecucion.estado = "Ejecucion";

        // Registramos el tiempo de respuesta
        if (procesoEnEjecucion.respuesta === null) {
            procesoEnEjecucion.respuesta = relojGlobal - procesoEnEjecucion.llegada;   // Determinado el tiempo mediante la formula
        }

        // Marcar primer tick en CPU para no incrementar tiempoTrans todavía
        procesoEnEjecucion._nuevoEnCPU = true;
    }

    // Ejecutar el proceso actual
    if (procesoEnEjecucion) {
        if (procesoEnEjecucion._nuevoEnCPU) {
            procesoEnEjecucion._nuevoEnCPU = false; // No incrementar en primer tick
        } else {
            procesoEnEjecucion.tiempoTrans++;
console.log({procesoEnejecución.tiempoTrans});
            procesoEnEjecucion.servicio++;
            procesoEnEjecucion.quantumTrans++;
        }
        // Si el proceso ha cumplido su tiempo
        if (procesoEnEjecucion.tiempoTrans >= procesoEnEjecucion.tiempoMax) {
            finalizarProceso(procesoEnEjecucion);
            procesoEnEjecucion = null; // Declaramos que ya no hay proceso en ejecucion
        }
    }

    // Si el proceso finalizo debido a un error
    if (terminadoError) {
        finalizarProceso(procesoEnEjecucion);
        procesoEnEjecucion = null;
        terminadoError = false;
    }

    // Si se cumple el periodo del quantum 
    if (procesoEnEjecucion && procesoEnEjecucion.quantumTrans >= quantum + 1 && listos.length > 0) {
        console.log("QUANTUM");
        procesoEnEjecucion.estado = "Listo";
        quantumCumplido = true; // Indicamos que se ha cumplido el quantum
        procesoEnEjecucion.quantumTrans = 0; // Reiniciamos el tiempo de quantum transcurrido
        procesoInterrumpido = procesoEnEjecucion;
        procesoEnEjecucion = null;
    }

    // Actualizar bloqueados
    bloqueados.forEach((p, idx) => {
        p.bloqueadoRestante--;
        if (p.bloqueadoRestante < 0) {
            p.estado = "Listo";
            p.quantumTrans = 0; // Reiniciamos su quantum transcurrido
            listos.push(p);
            bloqueados.splice(idx, 1);
        }
    });


    // Verificar si todos los procesos terminaron
    if (terminados.length === numProcesos) {
        clearInterval(intervalo);
        intervalo = null;
        let btnResultados = document.createElement('button');
        btnResultados.innerText = "Ver Resultados";
        document.getElementById('btnVerResultados').appendChild(btnResultados);
        btnResultados.addEventListener(`click`, () => {
            mostrarResultados();
        });
    }

    // Actualizar los procesos en memoria
    enMemoria = []; // Limpiamos el arreglo
    let indice = 0;
    console.log(procesoEnEjecucion);

    // Incluimos el proceso en ejecucion
    if (procesoEnEjecucion) {
        enMemoria[indice] = procesoEnEjecucion; // Añadimos el proceso en ejecucion
        indice++;
    }

    // Incluimos los procesos en "listos"
    listos.forEach(p => {
        enMemoria[indice++] = p; // Añadimos los procesos listos

    });

    // Si se interrumpio un proceso, este se agrega la final de "listos"
    if (procesoInterrumpido) {
        enMemoria[indice] = procesoInterrumpido; // Añadimos el proceso en ejecucion
        indice++;


    }

    // Incluimos los procesos bloqueados
    if (indice < 4) {
        bloqueados.forEach(p => {
            enMemoria[indice++] = p; // Añadimos los procesos bloqeuados
        });
    }

    console.log({ enMemoria });

    render(); // Actualizar pantalla


}

// ================================
// Finalizar proceso (normal o error)
// ================================
const finalizarProceso = (p) => {
    p.estado = "Terminado";
    p.finalizacion = relojGlobal;
    p.retorno = p.finalizacion - p.llegada;
    p.espera = p.retorno - p.servicio;

    try {
        if (!p.error) p.resultado = eval(p.op); // Evaluar operacion
        else p.resultado = "ERROR";
    } catch {
        p.resultado = "ERROR"; // Captura cualquier error de operacion
    }

    terminados.push(p);
}

// ================================
// Manejo de teclas: E, W, P, C
// ================================
document.addEventListener("keydown", (e) => {
    const tecla = e.key.toUpperCase();

    // Si estamos en pausa, solo permitir C para continuar
    if (pausado && tecla !== "C") return; // Ignorar otras teclas mientras esta en pausa

    if (tecla === "E" && procesoEnEjecucion) {
        // Mandar proceso a bloqueados por E/S
        procesoEnEjecucion.estado = "Bloqueado";
        procesoEnEjecucion.bloqueadoRestante = 8; // 8 seg
        bloqueados.push(procesoEnEjecucion);
        procesoEnEjecucion = null;
    } else if (tecla === "W" && procesoEnEjecucion) {
        // Terminar proceso por error
        procesoEnEjecucion.error = true;
        terminadoError = true;
        // finalizarProceso(procesoEnEjecucion);
        // procesoEnEjecucion = null;
    } else if (tecla === "P") {
        pausado = true; // Pausar simulacion
    } else if (tecla === "C") {
        pausado = false; // Continuar simulacion
        document.getElementById("faseEjecucion").style.display = "block";
        document.getElementById("pantallaBcp").style.display = "none";
    } else if (tecla === "N") {
        const nuevoProceso = generarProcesoUnico();
        nuevos.push(nuevoProceso);
        numProcesos++; // Aumenta el conteo total esperado
        render();
    } else if (tecla === "B") {
        pausado = true;
        document.getElementById("faseEjecucion").style.display = "none";
        document.getElementById("pantallaBcp").style.display = "block";
        mostrarBCP();

    }
});

const mostrarBCP = () => {
    document.getElementById("relojBCP").innerText = `Reloj: ${relojGlobal}`;
    let html = "<tr><th>ID</th><th>Operacion</th><th>Resultado</th><th>TME</th><th>Llegada</th><th>Finalización</th><th>Espera</th><th>Respuesta</th><th>Retorno</th><th>Servicio</th><th>Restante</th><th>Estado</th></tr>";
    terminados.forEach(p => {
        html += `<tr>
            <td>${p.id}</td>
            <td>${p.op}</td>
            <td>${p.resultado}</td>
            <td>${p.tiempoMax}</td>
            <td>${p.llegada}</td>
            <td>${p.finalizacion}</td>
            <td>${p.espera}</td>
            <td>${p.respuesta}</td>
            <td>${p.retorno}</td>
            <td>${p.servicio}</td>
            <td>${"0"}</td>
            <td>${p.estado}</td>
        </tr>`;
    });
    // Incluimos los procesos de memoria
    enMemoria.forEach(p => {
        let retornoParcial = relojGlobal - p.llegada;                   // Calcula el tiempo de retorno en funcion del reloj global
        let respuestaParcial = (p.respuesta == null) ? "-" : p.respuesta; // Evaluamos si el proceso ya cuenta con un tiempo de respuesta
        let esperaParcial = (relojGlobal - p.llegada) - p.tiempoTrans; // Calculamos el tiempo que ha esperado el proceso 
        let restante = p.tiempoMax - p.tiempoTrans;               // Calculamos el tiempo restante del proceso  
        html += `<tr>
            <td>${p.id}</td>
            <td>${p.op}</td>
            <td>${"-"}</td>
            <td>${p.tiempoMax}</td>
            <td>${p.llegada}</td>
            <td>${"-"}</td>
            <td>${esperaParcial}</td>
            <td>${respuestaParcial}</td>
            <td>${retornoParcial}</td>
            <td>${p.tiempoTrans}</td>
            <td>${restante}</td>
            <td>${p.estado}</td>
        </tr>`;
    })
    document.getElementById("bcp").innerHTML = html + `<button type="button" id="btnContinuar"> Continuar  </button>`;
    let continuar = document.getElementById('btnContinuar');


    continuar.addEventListener("click", () => {
        pausado = false;
        document.getElementById("faseEjecucion").style.display = "block";
        document.getElementById("pantallaBcp").style.display = "none";
    });
}

// ================================
// Función para crear un solo proceso aleatorio (Nuevo proceso)
// ================================
const generarProcesoUnico = () => {
    const tiempoMax = Math.floor(Math.random() * 15) + 6;
    let a = Math.floor(Math.random() * 10) + 1;
    let b = Math.floor(Math.random() * 10) + 1;
    let ops = ["+", "-", "*", "/", "%"];
    let op = ops[Math.floor(Math.random() * ops.length)];
    if ((op === "/" || op === "%") && b === 0) b = 1;

    const proceso = {
        id: idContador++,
        op: `${a} ${op} ${b}`,
        a,
        b,
        operador: op,
        tiempoMax,
        tiempoTrans: 0,
        estado: "Nuevo",
        llegada: null,
        finalizacion: null,
        retorno: null,
        respuesta: null,
        espera: 0,
        servicio: 0,
        resultado: null,
        error: false,
        bloqueadoRestante: 0,
        quantumTrans: 0
    };
    return proceso;
};

// ================================
// Renderizar en pantalla
// ================================
const render = () => {
    document.getElementById("reloj").innerText = `Reloj: ${relojGlobal}`;
    document.getElementById("nuevos").innerText = nuevos.length;
    document.getElementById("tiempoQuantum").innerText = quantum;

    // Mostrar tabla de Listos
    let htmlListos = "<tr><th>ID</th><th>TME</th><th>Trans</th></tr>";
    listos.forEach(p => {
        htmlListos += `<tr><td>${p.id}</td><td>${p.tiempoMax}</td><td>${p.tiempoTrans}</td></tr>`;
    });
    document.getElementById("tablaListos").innerHTML = htmlListos;

    let mensajeCPU = "";

    const procesosEnMemoria = listos.length + bloqueados.length + (procesoEnEjecucion ? 1 : 0);

    if (procesoEnEjecucion) {
        // Proceso normal en ejecución
        mensajeCPU = `
        <p>ID: ${procesoEnEjecucion.id}</p>
        <p>Operacion: ${procesoEnEjecucion.op}</p>
        <p>Trans: ${procesoEnEjecucion.tiempoTrans}</p>
        <p>Quantum: ${procesoEnEjecucion.quantumTrans}</p>
        <p>Restante: ${procesoEnEjecucion.tiempoMax - procesoEnEjecucion.tiempoTrans}</p>
    `;
    } else if ((procesosEnMemoria > 0 && listos.length === 0 && bloqueados.length === procesosEnMemoria) || (procesosEnMemoria <= 0)) {
        // Todos los procesos en memoria están bloqueados → Proceso nulo
        mensajeCPU = "CPU: Proceso nulo";
    } else {
        // CPU libre (no hay procesos en memoria listos ni bloqueados)
        mensajeCPU = "Cambio de Contexto";
    }

    document.getElementById("ejecucion").innerHTML = mensajeCPU;


    // Mostrar tabla de Bloqueados
    let htmlBloq = "<tr><th>ID</th><th>Tiempo Bloq Rest</th></tr>";
    bloqueados.forEach(p => {
        htmlBloq += `<tr><td>${p.id}</td><td>${p.bloqueadoRestante}</td></tr>`;
    });
    document.getElementById("tablaBloqueados").innerHTML = htmlBloq;

    // Mostrar tabla de Terminados
    let htmlTerm = "<tr><th>ID</th><th>Operacion</th><th>Resultado</th></tr>";
    terminados.forEach(p => {
        htmlTerm += `<tr><td>${p.id}</td><td>${p.op}</td><td>${p.resultado}</td></tr>`;
    });
    document.getElementById("tablaTerminados").innerHTML = htmlTerm;
}

// ================================
// Mostrar resultados finales
// ================================
const mostrarResultados = () => {
    // Ocultar fase Ejecucion y mostrar Resultados
    document.getElementById("faseEjecucion").style.display = "none";
    document.getElementById("faseResultados").style.display = "block";

    // Crear tabla con todas las mediciones de cada proceso
    let html = "<tr><th>ID</th><th>Llegada</th><th>Final</th><th>Retorno</th><th>Respuesta</th><th>Espera</th><th>Servicio</th><th>Resultado</th></tr>";
    terminados.forEach(p => {
        html += `<tr>
            <td>${p.id}</td>
            <td>${p.llegada}</td>
            <td>${p.finalizacion}</td>
            <td>${p.retorno}</td>
            <td>${p.respuesta}</td>
            <td>${p.espera}</td>
            <td>${p.servicio}</td>
            <td>${p.resultado}</td>
        </tr>`;
    });
    document.getElementById("tablaResultados").innerHTML = html + `<button type="button" id="btnFinalizar"> Finalizar  </button>`;

    let finalizar = document.getElementById('btnFinalizar');
    finalizar.addEventListener('click', () => {
        location.reload();
    })
}