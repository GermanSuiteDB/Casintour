/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

 define(['N/search', 'N/record', 'N/https', 'N/runtime'],
    function (search, record, https, runtime) {
        let headers = {
            'User-Agent': 'Suitelet',
            'Connection': 'keep-alive',
            'not-version': 'any',
            'Content-Type': 'application/json'
        }
        const baseURL = 'https://cloud.nominaz.com';
        const urlToken = '/role_manager/oauth2/token';
        const urlEmployees = '/nominaz/server/index.php/nominaz/reportes/ObtenerReporteEmpleados';
        const urlPayments = '/report/horizontal_payroll';
        const bodyEmployees = {
            "data": {
                "filtros": {
                    "estado": null
                },
                "conceptosFiltrados": [
                    "codigo",
                    "documento",
                    "nombre",
                    "apellido",
                    "codigoIess",
                    "genero",
                    "tipoDocumento",
                    "paisResidencia",
                    "paisNacimiento",
                    "provinciaResidencia",
                    "ciudadResidencia",
                    "direccion",
                    "telefonos",
                    "celular",
                    "email",
                    "fechaNacimiento",
                    "estadoCivil",
                    "nombrePareja",
                    "hijos",
                    "numeroHijos",
                    "cargaFamiliarHijo",
                    "asistencia",
                    "fechaIngreso",
                    "fechaSalida",
                    "nivelUno",
                    "nivelDos",
                    "nivelTres",
                    "nivelCuatro",
                    "turno",
                    "cargo",
                    "jefeDirecto",
                    "valorRetencionJudicial",
                    "cargaFamiliarConyugue",
                    "confidencial",
                    "categoria",
                    "anticipoQuincenal",
                    "valorAntipoQuincenal",
                    "tipoAntipoQuincenal",
                    "jornada",
                    "horas",
                    "seguroMedico",
                    "seguroConyuge",
                    "codigoSectorial",
                    "estadoHistorico",
                    "estudios",
                    "sangre",
                    "sueldo",
                    "grupoLiquidacion",
                    "fondosReserva",
                    "fondosReservaIngreso",
                    "decimoTercero",
                    "decimoCuarto",
                    "contrato",
                    "formaPago",
                    "tipoCuentaBancaria",
                    "cuentaBancaria",
                    "bancoCodigo",
                    "bancoCodigoOrigen",
                    "neto",
                    "tiempoVacacionesAdicionales",
                    "establecimiento",
                    "dobleImposicion",
                    "condicion",
                    "porcentajeDiscapacidad",
                    "identificacionDiscapacidad",
                    "estado",
                    "galapagos",
                    "documentoDiscapacidad",
                    "enfermedadCatastrofica",
                ]
            }
        };
        let bodyPayments = {
            "conceptos": ["00001-CRI", "00002-CRI", "00022-CRD", "00023-CRD", "00007-CRP", "00008-CRP"],
            "datosBusqueda": {
                "preliquidacionHabilitada": false
            },
            "agrupar": false
        }

        function getInputData() {
            try {
                //get token
                let scriptObj = runtime.getCurrentScript();
                let responseToken = getRefreshToken(scriptObj) 
                let token = responseToken?.body ? JSON.parse(responseToken.body)?.response?.accessToken : null;
                if (!token) {
                    log.error('could not generate token', responseToken)
                    return [];
                }
                headers['x-api-key-nominaz'] = token;

                //get employees
                let responseEmployees = postRequest(baseURL + urlEmployees, bodyEmployees);
                let employees = responseEmployees?.body ? JSON.parse(responseEmployees.body)?.response : null;
                if (!employees || !employees.length) {
                    log.error('could not obtain employee list', responseEmployees)
                    return [];
                }

                return employees;
            } catch (error) {
                log.error({
                    title: 'Error in getInputData function',
                    details: error.message
                })
            }
        }

        function map(context) {
            try {
                var data = JSON.parse(context.value);
                log.debug("map data", data);
                if (data.documento !== '0919282699') return;
                
                //search for employee
                let employeeDocumentNumber = data.documento;
                let existingId = searchEmployeeId(employeeDocumentNumber);

                let employeePhone = data.celular.trim() || null;

                let employee;

                //create employee if it does not exist
                if (existingId === -1) {
                    employee = createNewEmployee();
                } else {
                    employee = record.load({type: record.Type.EMPLOYEE,id: existingId,isDynamic: true})
                }

                employee.setValue({
                    fieldId: 'jobdescription',
                    value: data.cargo.trim()
                }).setValue({
                    fieldId: 'email',
                    value: data.email.trim()
                }).setValue({
                    fieldId: 'birthdate',
                    value: parseDate(data.fechaNacimiento.trim())
                }).setValue({
                    fieldId: 'hiredate',
                    value: parseDate(data.fechaIngreso.trim())
                }).setValue({
                    fieldId: 'employeestatus',
                    value: 2
                });

                if (employeePhone) employee.setValue({
                    fieldId: 'mobilephone',
                    value: employeePhone
                })

                let gender = getGender(data.genero.trim());
                employee.setValue({
                    fieldId: 'gender',
                    value: gender
                })
                let phone = getPhone(data.telefonos);
                if (phone) employee.setValue({
                    fieldId: 'phone',
                    value: phone
                })
                let supervisor = searchEmployeeId(data.jefeDirecto.trim());
                if (supervisor !== -1) employee.setValue({
                    fieldId: 'supervisor',
                    value: supervisor
                })
                let employeeId = employee.save({
                    ignoreMandatoryFields: true
                });
                if (existingId === -1) log.audit('employee created', employeeId);
                else log.audit('employee updated', employeeId);
                // log.audit('employee created test', data.documento)

            } catch (error) {
                log.error({
                    title: 'Error in Map function',
                    details: error.message
                })
            }
        }

        function reduce(context) {
            try {
              return
                var data = JSON.parse(context.values);
                // log.debug("reduce data", data);

            } catch (error) {
                log.error({
                    title: 'Error in Reduce function',
                    details: error.message
                })
            }
        }

        function postRequest(url, JSONRequestBody) {
            try {
                var response = https.post({
                    body: JSON.stringify(JSONRequestBody),
                    url: url,
                    headers: headers
                });
                return response;
            } catch (error) {
                log.error({
                    title: 'Error in postRequest function',
                    details: error
                });
            }
        }

        function parseDate(dateStr) {
            let parts = dateStr.split("-");
            let day = parts[2];
            let month = parseInt(parts[1], 10) - 1;
            let year = parts[0].length === 2 ? "20" + parts[0] : parts[0];
            return new Date(year, month, day);
        }

        function searchEmployeeId(employeeDocumentNumber) {
            var employeeFoundInternalId = null;
            try {
                if(!employeeDocumentNumber)return employeeFoundInternalId;
                var employeeSearchObj = search.create({
                    type: "employee",
                    filters:
                    [
                       ["custentitysdb_id_del_erp_anterior","is",employeeDocumentNumber]
                    ],
                    columns:
                    [
                       search.createColumn({name: "internalid", label: "ID interno"})
                    ]
                });
                employeeSearchObj.run().each(function(result){
                   log.debug("employee result",result);
                   employeeFoundInternalId = result.getValue({fieldId:"internalid"});
                   return false;
                });
                return employeeFoundInternalId;
            } catch (error) {
                log.error("searchEmployeeId error",error);
                return employeeFoundInternalId;
            }
        }

        function createNewEmployee(data){
            try {
                let firstName = data.nombre.trim();
                let lastName = data.apellido.trim(); 

                employee = record.create({type: record.Type.EMPLOYEE,isDynamic: true});
                employee.setValue({fieldId: 'firstname',value: firstName});
                employee.setValue({fieldId: 'lastname',value: lastName});

                //employee address
                let employeeAddrs1 = data.direccion.trim() || null;
                let employeeCountry = data.paisResidencia.trim() || null;
                let employeeCity = data.ciudadResidencia.trim() || null;
                let employeeState = data.provinciaResidencia.trim() || null;
                if (employeeAddrs1 && employeeCountry && employeeCity) {
                    employee.selectNewLine({sublistId: 'addressbook'});
                    let employeeNewAddress = employee.getCurrentSublistSubrecord({sublistId: 'addressbook',fieldId: 'addressbookaddress'});
                    employeeNewAddress.setText({fieldId: 'country',value: employeeCountry});
                    employeeNewAddress.setValue({fieldId: 'addr1',value: employeeAddrs1});
                    employeeNewAddress.setValue({fieldId: 'city',value: employeeCity});
                    if (employeeState) employeeNewAddress.setValue({fieldId: 'state',value: employeeState});
                    if (employeePhone) employeeNewAddress.setValue({fieldId: 'addrphone',value: employeePhone});
                    employee.commitLine({sublistId: 'addressbook'});
                }
            } catch (error) {
                log.error("createEmployee error",error);
            }
        }

        function getGender(gender) {
            var notSpecified = 'ns';
            try {
                if (!gender) return notSpecified;
                if (gender === 'Masculino') return 'm';
                if (gender === 'Femenino') return 'f'
                return notSpecified;
            } catch (error) {
                log.error("getGender error", error);
                return notSpecified;
            }
        }

        // function getCivilStatus(employee, civilStatus) {
        //     var returnValue = null;
        //     try {
        //         if (!civilStatus) return returnValue;
        //         let field = employee.getField({
        //             fieldId: 'maritalstatus'
        //         });
        //         let options = field.getSelectOptions({
        //             filter: null
        //         });
        //         for (let i = 0; i < options.length; i++) {
        //             const option = options[i];
        //             if (option.text.trim().toUpperCase() === civilStatus.trim().toUpperCase()) {
        //                 returnValue = option.value;
        //                 break;
        //             }
        //         }
        //         return returnValue;
        //     } catch (error) {
        //         log.error("getCivilStatus error", error);
        //         return returnValue;
        //     }
        // }

        function parseBool(bool) {
            try {
                if (!bool) return false;
                if (bool.toUpperCase() === 'SI') return true;
                return false;
            } catch (error) {
                log.error("parseBool error", error);
                return false;
            }
        }
        function getPhone(phone) {
            try {
                if (!phone) return null;
                return phone.trim();
            } catch (error) {
                log.error("getPhone error", error);
                return null;
            }
        }
        function parseNumber(number) {
            try {
                if (!number) return 0;
                return parseInt(number);
            } catch (error) {
                log.error("parseNumber error", error);
                return 0;
            }
        }
        function getCouplesName(coupleName) {
            var notSpecified = null;
            try {
                if (!coupleName || coupleName === '0') return notSpecified;
                return coupleName.trim();
            } catch (error) {
                log.error("getCouplesName error", error);
                return notSpecified
            }
        }
        function getRefreshToken(scriptObj){
            try {
                var clientId = scriptObj.getParameter({ name: 'custscript_sdb_client_id_nominaz' });
                var clientSecret = scriptObj.getParameter({ name: 'custscript_sdb_client_secret_nominaz' });
                const bodyToken = {
                    "client_id": clientId,
                    "client_secret": clientSecret,
                    "grant_type": "client_credentials"
                };
                var refreshTokenRespone = postRequest(baseURL + urlToken, bodyToken);
                return refreshTokenRespone;
            } catch (error) {
                log.error("getRefreshToken error",error);
                return null;
            }
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        }
    });
